"use server";

import { db } from "@/lib/db";
import type { CandidateStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendOnboardingEmail, sendWelcomeEmail } from "@/lib/email";

export async function getCandidates(filters?: {
  status?: CandidateStatus;
  positionId?: string;
  search?: string;
  inPipeline?: boolean;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.positionId) where.positionId = filters.positionId;
  if (filters?.inPipeline !== undefined) where.inPipeline = filters.inPipeline;
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { resumeText: { contains: filters.search, mode: "insensitive" } },
      { skills: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.candidate.findMany({
    where,
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCandidate(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  skills: string[];
  experience?: string;
  source?: string;
  positionId?: string;
  recruiterId?: string;
  resumeText?: string;
  linkedinUrl?: string;
  costOfHire?: number;
  notes?: string;
  resumeUrl?: string;
  inPipeline?: boolean;
  jobAppliedTo?: string;
}) {
  const { skills, inPipeline = true, ...rest } = data;
  const candidate = await db.candidate.create({
    data: {
      ...rest,
      skills: JSON.stringify(skills),
      inPipeline,
    },
  });
  revalidatePath("/cv");
  return candidate;
}

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  BACKGROUND_CHECK: "Background Check",
  PRE_ONBOARDING: "Pre-Onboarding",
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

const DOC_STAGES = ["HIRED", "PRE_ONBOARDING", "ONBOARDING", "OFFBOARDING"];

async function sendStageDocumentsEmail(
  status: string,
  candidate: { id: string; firstName: string; lastName: string; email: string; phone: string | null; hourlyRate: number | null; positionId: string | null },
  employeeId?: string,
  startDate?: string | Date | null
) {
  if (!DOC_STAGES.includes(status) || !candidate.email) return;

  try {
    const { getStageDocuments } = await import("@/lib/actions/stage-documents");
    const { fillPdfPlaceholders } = await import("@/lib/stage-document-utils");
    const { sendEmailWithAttachments } = await import("@/lib/email");
    const { getCompanySettings } = await import("@/lib/actions/company-settings");
    const [docs, settings] = await Promise.all([
      getStageDocuments(status),
      getCompanySettings(),
    ]);
    console.log(`[stage-docs] Found ${docs.length} docs for stage ${status}, candidate ${candidate.email}`);

    const position = candidate.positionId
      ? await db.position.findUnique({ where: { id: candidate.positionId }, select: { title: true } })
      : null;
    const candidateInfo = {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      hourlyRate: candidate.hourlyRate,
      position,
      startDate,
    };
    const pdfDocs = docs.filter((d) => d.pdfData);
    console.log(`[stage-docs] ${pdfDocs.length} docs have PDF data`);
    if (pdfDocs.length === 0) return;

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const attachmentDocs: typeof pdfDocs = [];
    const signingDocs: typeof pdfDocs = [];
    const fillDocs: typeof pdfDocs = [];

    for (const doc of pdfDocs) {
      if (doc.requiresSignature) {
        signingDocs.push(doc);
      } else if (doc.requiresFill) {
        fillDocs.push(doc);
      } else {
        attachmentDocs.push(doc);
      }
    }

    // Handle docs that require signing — upload filled PDF to FileBlob, create signing request
    for (const doc of signingDocs) {
      const positions = JSON.parse(doc.placeholders || "[]");
      console.log(`[stage-docs] Filling "${doc.name}" for signing, ${positions.length} placeholders`);
      const { pdf: filledPdf, signaturePlacements } = await fillPdfPlaceholders(doc.pdfData!, positions, candidateInfo, settings.companyName);

      // Store the filled PDF in FileBlob
      const { randomUUID } = await import("crypto");
      const filename = `${randomUUID()}.pdf`;
      const buffer = Buffer.from(filledPdf);
      await db.fileBlob.create({
        data: { filename, mimeType: "application/pdf", size: buffer.length, data: buffer },
      });
      const documentUrl = `/api/onboarding-docs/${filename}`;

      // Create signing request (sends email automatically)
      const { createStandaloneSigningRequest } = await import("@/lib/actions/signing");
      await createStandaloneSigningRequest({
        employeeId: employeeId || undefined,
        candidateId: employeeId ? undefined : candidate.id,
        signerName: employeeId ? undefined : `${candidate.firstName} ${candidate.lastName}`,
        signerEmail: employeeId ? undefined : candidate.email,
        documentUrl,
        documentName: doc.name,
        signaturePlacements,
        countersignerId: doc.requiresCountersignature ? doc.countersignerId : null,
      });
      console.log(`[stage-docs] Created signing request for "${doc.name}" with ${signaturePlacements.length} signature placements`);
    }

    // Handle docs that require filling — upload filled PDF (with placeholders pre-filled), create fill request
    for (const doc of fillDocs) {
      const positions = JSON.parse(doc.placeholders || "[]");
      console.log(`[stage-docs] Filling "${doc.name}" for fill form, ${positions.length} placeholders`);
      const { pdf: filledPdf, signaturePlacements } = await fillPdfPlaceholders(doc.pdfData!, positions, candidateInfo, settings.companyName);

      const { randomUUID } = await import("crypto");
      const filename = `${randomUUID()}.pdf`;
      const buffer = Buffer.from(filledPdf);
      await db.fileBlob.create({
        data: { filename, mimeType: "application/pdf", size: buffer.length, data: buffer },
      });
      const documentUrl = `/api/onboarding-docs/${filename}`;

      // Create a signing request (reused for fill) and send fill email
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.signingRequest.create({
        data: {
          employeeId: employeeId || null,
          candidateId: employeeId ? null : candidate.id,
          signerName: `${candidate.firstName} ${candidate.lastName}`,
          signerEmail: candidate.email,
          token,
          documentUrl,
          documentName: doc.name,
          expiresAt,
          signaturePlacements: signaturePlacements.length > 0 ? signaturePlacements : undefined,
          countersignerId: doc.requiresCountersignature ? doc.countersignerId : null,
        },
      });

      const { sendFillRequestEmail } = await import("@/lib/email");
      await sendFillRequestEmail({
        to: candidate.email,
        firstName: candidate.firstName,
        documentName: doc.name,
        fillUrl: `${baseUrl}/fill/${token}`,
      });
      console.log(`[stage-docs] Created fill request for "${doc.name}"`);
    }

    // Handle attachment-only docs
    if (attachmentDocs.length > 0) {
      const attachments = [];
      for (const doc of attachmentDocs) {
        const positions = JSON.parse(doc.placeholders || "[]");
        console.log(`[stage-docs] Filling "${doc.name}" as attachment, ${positions.length} placeholders, hourlyRate=${candidateInfo.hourlyRate}`);
        const { pdf: filledPdf } = await fillPdfPlaceholders(doc.pdfData!, positions, candidateInfo, settings.companyName);
        const pdfBuffer = Buffer.from(filledPdf);
        attachments.push({
          filename: `${doc.name}.pdf`,
          content: pdfBuffer,
        });

        // Store as Document record on employee so it shows on their card
        if (employeeId) {
          const { randomUUID } = await import("crypto");
          const filename = `${randomUUID()}.pdf`;
          await db.fileBlob.create({
            data: { filename, mimeType: "application/pdf", size: pdfBuffer.length, data: pdfBuffer },
          });
          await db.document.create({
            data: {
              employeeId,
              name: doc.name,
              url: `/api/onboarding-docs/${filename}`,
              category: "ONBOARDING",
            },
          });
          console.log(`[stage-docs] Created Document record "${doc.name}" for employee ${employeeId}`);
        }
      }
      console.log(`[stage-docs] Sending ${attachments.length} attachments to ${candidate.email}`);
      await sendEmailWithAttachments(
        candidate.email,
        `Documents: ${STAGE_LABELS[status] || status}`,
        `<p>Hi ${candidate.firstName},</p>
        <p>Please find your ${STAGE_LABELS[status] || status} documents attached.</p>
        <p>${attachments.length} document${attachments.length > 1 ? "s" : ""} attached.</p>`,
        attachments
      );
    }

    console.log(`[stage-docs] All docs processed for ${candidate.email} (${attachmentDocs.length} attached, ${signingDocs.length} signing)`);
  } catch (err) {
    console.error(`[stage-docs] Failed to send docs for ${status} to ${candidate.email}:`, err);
  }
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus
) {
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) throw new Error("Candidate not found");

  const previousStatus = candidate.status;
  const data: Record<string, unknown> = { status };
  if (status === "HIRED") data.hiredAt = new Date();

  const updated = await db.candidate.update({ where: { id }, data });

  // Send stage-change notification via centralized rules engine (non-blocking)
  if (previousStatus !== status) {
    const { sendNotifications } = await import("@/lib/notifications/send");
    const stageLabel = STAGE_LABELS[status] || status;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const rateInfo = candidate.hourlyRate
      ? `<p>Hourly rate: <strong>$${candidate.hourlyRate.toFixed(2)}/hr</strong></p>`
      : "";

    sendNotifications({
      action: "STAGE_CHANGE",
      candidateId: id,
      message: `${candidateName} moved to ${stageLabel}`,
      link: "/cv",
      emailSubject: `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
      emailBody: `<p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>${rateInfo}`,
    }).catch((err) => console.error("[candidates] Notification error:", err));

    // Send stage PDF documents for onboarding/offboarding stages
    await sendStageDocumentsEmail(status, candidate);
  }

  revalidatePath("/cv");
  return updated;
}

export async function searchCandidates(query: string) {
  const candidates = await db.candidate.findMany({
    where: {
      OR: [
        { resumeText: { contains: query, mode: "insensitive" } },
        { skills: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });
  return candidates;
}

export async function advancedSearchCandidates(params: {
  query?: string;
  status?: string;
  source?: string;
  positionId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];

  if (params.query) {
    andConditions.push({
      OR: [
        { firstName: { contains: params.query, mode: "insensitive" } },
        { lastName: { contains: params.query, mode: "insensitive" } },
        { email: { contains: params.query, mode: "insensitive" } },
        { resumeText: { contains: params.query, mode: "insensitive" } },
        { skills: { contains: params.query, mode: "insensitive" } },
        { experience: { contains: params.query, mode: "insensitive" } },
        { notes: { contains: params.query, mode: "insensitive" } },
      ],
    });
  }

  if (params.status) {
    andConditions.push({ status: params.status });
  }

  if (params.source) {
    andConditions.push({ source: params.source });
  }

  if (params.positionId) {
    andConditions.push({ positionId: params.positionId });
  }

  if (params.dateFrom) {
    andConditions.push({ createdAt: { gte: new Date(params.dateFrom) } });
  }

  if (params.dateTo) {
    andConditions.push({ createdAt: { lte: new Date(params.dateTo) } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const candidates = await db.candidate.findMany({
    where,
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });

  return candidates;
}

export async function bulkImportCandidates(
  candidates: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    skills?: string;
    experience?: string;
    source?: string;
    linkedinUrl?: string;
    notes?: string;
  }[]
): Promise<{ created: number; skipped: string[]; errors: string[] }> {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    throw new Error("Not authorized to bulk-import candidates");
  }
  const errors: string[] = [];

  // Filter out candidates without email
  const valid = candidates.filter((c) => c.email && c.firstName);

  // Get all existing emails in one query
  const existingEmails = new Set(
    (await db.candidate.findMany({
      where: { email: { in: valid.map((c) => c.email) } },
      select: { email: true },
    })).map((c) => c.email)
  );

  const skipped = valid.filter((c) => existingEmails.has(c.email)).map((c) => c.email);
  const toCreate = valid.filter((c) => !existingEmails.has(c.email));

  // Deduplicate by email within the batch
  const seen = new Set<string>();
  const uniqueToCreate = toCreate.filter((c) => {
    if (seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });

  // Batch create in chunks of 500
  let created = 0;
  const CHUNK_SIZE = 500;

  for (let i = 0; i < uniqueToCreate.length; i += CHUNK_SIZE) {
    const chunk = uniqueToCreate.slice(i, i + CHUNK_SIZE);
    try {
      const result = await db.candidate.createMany({
        data: chunk.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone || null,
          skills: c.skills
            ? JSON.stringify(c.skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean))
            : null,
          experience: c.experience || null,
          source: c.source || null,
          linkedinUrl: c.linkedinUrl || null,
          notes: c.notes || null,
          inPipeline: false,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${message}`);
    }
  }

  revalidatePath("/cv");

  return { created, skipped, errors };
}

export async function getDistinctSources(): Promise<string[]> {
  const results = await db.candidate.findMany({
    where: { source: { not: null } },
    select: { source: true },
    distinct: ["source"],
  });

  return results.map((r) => r.source).filter((s): s is string => s !== null);
}

export async function updateCandidate(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    skills?: string[];
    experience?: string;
    source?: string;
    notes?: string;
    positionId?: string;
    costOfHire?: number;
    hourlyRate?: number;
    managerId?: string;
    recruiterId?: string;
    status?: CandidateStatus;
  }
) {
  const existing = await db.candidate.findUnique({ where: { id } });
  const previousStatus = existing?.status;

  const { skills, status, ...rest } = data;
  const updateData: Record<string, unknown> = { ...rest };
  if (skills !== undefined) updateData.skills = JSON.stringify(skills);
  if (status !== undefined) {
    updateData.status = status;
    if (status === "HIRED") updateData.hiredAt = new Date();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate = await db.candidate.update({ where: { id }, data: updateData });

  // Send stage-change notification via centralized rules engine
  if (status && previousStatus && previousStatus !== status) {
    const { sendNotifications } = await import("@/lib/notifications/send");
    const stageLabel = STAGE_LABELS[status] || status;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const rate = candidate.hourlyRate;
    const rateInfo = rate
      ? `<p>Hourly rate: <strong>$${rate.toFixed(2)}/hr</strong></p>`
      : "";

    sendNotifications({
      action: "STAGE_CHANGE",
      candidateId: id,
      message: `${candidateName} moved to ${stageLabel}`,
      link: "/cv",
      emailSubject: `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
      emailBody: `<p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>${rateInfo}`,
    }).catch((err) => console.error("[candidates] Notification error:", err));

    // Send stage PDF documents
    await sendStageDocumentsEmail(status, candidate);
  }

  revalidatePath("/cv");
  return candidate;
}

export async function updateCandidateNotes(id: string, notes: string) {
  const candidate = await db.candidate.update({
    where: { id },
    data: { notes },
  });
  revalidatePath("/cv");
  return candidate;
}

export async function hireCandidateAndStartOnboarding(
  candidateId: string,
  options?: { companyEmail?: string; startDate?: string; managerId?: string; skipEmail?: boolean }
) {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: { include: { department: true } } },
  });
  if (!candidate) throw new Error("Candidate not found");

  let skillsText = "";
  if (candidate.skills) {
    try {
      const parsed = JSON.parse(candidate.skills);
      skillsText = Array.isArray(parsed) ? parsed.join(", ") : candidate.skills;
    } catch {
      skillsText = candidate.skills;
    }
  }

  const bio = [
    skillsText ? `Skills: ${skillsText}` : null,
    candidate.experience ? `Experience: ${candidate.experience}` : null,
    candidate.notes ? `Notes: ${candidate.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Use company email if provided, otherwise fall back to candidate's personal email
  const skipEmail = options?.skipEmail === true;
  const employeeEmail = skipEmail ? candidate.email : (options?.companyEmail?.trim() || candidate.email);
  const startDate = options?.startDate ? new Date(options.startDate) : new Date();

  // If skipEmail (pre-onboarding), set status to PRE_ONBOARDING directly
  const initialStatus = skipEmail ? "PRE_ONBOARDING" : "ONBOARDING";

  const employee = await db.employee.create({
    data: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: employeeEmail,
      phone: candidate.phone,
      jobTitle: candidate.position?.title || "New Hire",
      departmentId: candidate.position?.departmentId || null,
      managerId: options?.managerId || candidate.managerId || null,
      startDate,
      anniversaryDate: startDate,
      bio: bio || null,
      status: initialStatus,
    },
  });

  // Create user account and send welcome email (skip if pre-onboarding without company email)
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!skipEmail) {
    const existingUser = await db.user.findUnique({ where: { email: employeeEmail } });
    if (!existingUser) {
      await db.user.create({
        data: {
          email: employeeEmail,
          role: "EMPLOYEE",
          employeeId: employee.id,
        },
      });
    } else if (!existingUser.employeeId) {
      await db.user.update({
        where: { id: existingUser.id },
        data: { employeeId: employee.id },
      });
    }

    await sendWelcomeEmail({
      to: employeeEmail,
      role: "Employee",
      loginUrl: `${baseUrl}/login`,
    });
  }

  // If skipEmail, assign pre-onboarding tasks and return early
  if (skipEmail) {
    const { resolvePreOnboardingTasks } = await import("./onboarding-resolution");
    const deptId = candidate.position?.departmentId || null;
    const jobTitleStr = candidate.position?.title || null;
    const preOnboardingTasks = await resolvePreOnboardingTasks(deptId, jobTitleStr);

    for (const task of preOnboardingTasks) {
      await db.employeeTask.create({
        data: {
          employeeId: employee.id,
          checklistItemId: task.checklistItemId,
          title: task.title,
          description: task.description,
          documentAction: task.documentAction,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
          assigneeId: task.assigneeId,
        },
      });
    }

    await db.candidate.update({
      where: { id: candidateId },
      data: { status: "HIRED", inPipeline: false, hiredAt: new Date() },
    });

    // Send NEW_HIRE notification
    const { sendNotifications } = await import("@/lib/notifications/send");
    sendNotifications({
      action: "NEW_HIRE",
      candidateId,
      message: `${candidate.firstName} ${candidate.lastName} has been hired`,
      link: "/onboarding",
      emailSubject: `New Hire: ${candidate.firstName} ${candidate.lastName}`,
      emailBody: `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> has been hired and onboarding has started.</p>`,
    }).catch((err) => console.error("[candidates] New hire notification error:", err));

    // Send stage documents for PRE_ONBOARDING
    await sendStageDocumentsEmail("PRE_ONBOARDING", candidate, employee.id, startDate);

    revalidatePath("/cv");
    revalidatePath("/pre-onboarding");
    revalidatePath("/people");
    return { employee, taskCount: preOnboardingTasks.length };
  }

  // Check for pre-onboarding tasks first
  const { resolveOnboardingTasks, resolvePreOnboardingTasks } = await import("./onboarding-resolution");
  const { createSigningRequest } = await import("./signing");
  const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");

  const deptId = candidate.position?.departmentId || null;
  const jobTitleStr = candidate.position?.title || null;

  const preOnboardingTasks = await resolvePreOnboardingTasks(deptId, jobTitleStr);

  if (preOnboardingTasks.length > 0) {
    // Has pre-onboarding tasks — set status to PRE_ONBOARDING and assign those
    await db.employee.update({ where: { id: employee.id }, data: { status: "PRE_ONBOARDING" } });

    for (const task of preOnboardingTasks) {
      await db.employeeTask.create({
        data: {
          employeeId: employee.id,
          checklistItemId: task.checklistItemId,
          title: task.title,
          description: task.description,
          documentAction: task.documentAction,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
          assigneeId: task.assigneeId,
        },
      });
    }

    // Update candidate status
    await db.candidate.update({
      where: { id: candidateId },
      data: { status: "HIRED", inPipeline: false, hiredAt: new Date() },
    });

    // Send NEW_HIRE notification
    const { sendNotifications: sendNotifs } = await import("@/lib/notifications/send");
    sendNotifs({
      action: "NEW_HIRE",
      candidateId,
      message: `${candidate.firstName} ${candidate.lastName} has been hired`,
      link: "/onboarding",
      emailSubject: `New Hire: ${candidate.firstName} ${candidate.lastName}`,
      emailBody: `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> has been hired and onboarding has started.</p>`,
    }).catch((err) => console.error("[candidates] New hire notification error:", err));

    // Send stage documents for PRE_ONBOARDING
    await sendStageDocumentsEmail("PRE_ONBOARDING", candidate, employee.id, startDate);

    revalidatePath("/cv");
    revalidatePath("/onboarding");
    revalidatePath("/people");
    return { employee, taskCount: preOnboardingTasks.length };
  }

  const resolvedTasks = await resolveOnboardingTasks(deptId, jobTitleStr);

  for (const task of resolvedTasks) {
    const employeeTask = await db.employeeTask.create({
      data: {
        employeeId: employee.id,
        checklistItemId: task.checklistItemId,
        title: task.title,
        description: task.description,
        documentAction: task.documentAction,
        documentUrl: task.documentUrl,
        documentName: task.documentName,
        assigneeId: task.assigneeId,
      },
    });

    // Handle document actions — send to company email
    if (task.documentAction === "SEND" && task.sendEmail && task.emailSubject && task.emailBody) {
      await sendOnboardingEmail({
        to: employeeEmail,
        subject: task.emailSubject,
        body: task.emailBody,
        documentUrl: task.documentUrl,
        documentName: task.documentName,
      });
    } else if (task.documentAction === "SIGN" && task.documentUrl && task.documentName) {
      const signingReq = await createSigningRequest(
        employeeTask.id,
        employee.id,
        task.documentUrl,
        task.documentName
      );
      await sendSigningRequestEmail({
        to: employeeEmail,
        firstName: candidate.firstName,
        documentName: task.documentName,
        signingUrl: `${baseUrl}/sign/${signingReq.token}`,
      });
    } else if (task.sendEmail && task.emailSubject && task.emailBody) {
      await sendOnboardingEmail({
        to: employeeEmail,
        subject: task.emailSubject,
        body: task.emailBody,
      });
    }

    // Notify assigned employee
    if (task.assigneeId) {
      const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
      if (assignee) {
        await sendTaskAssignmentEmail({
          to: assignee.email,
          assigneeName: assignee.firstName,
          newHireName: `${candidate.firstName} ${candidate.lastName}`,
          taskTitle: task.title,
          taskDescription: task.description,
        });
      }
    }
  }

  await db.candidate.update({
    where: { id: candidateId },
    data: { status: "HIRED", hiredAt: new Date() },
  });

  // Send NEW_HIRE notification
  const { sendNotifications: sendHireNotifs } = await import("@/lib/notifications/send");
  sendHireNotifs({
    action: "NEW_HIRE",
    candidateId,
    message: `${candidate.firstName} ${candidate.lastName} has been hired`,
    link: "/onboarding",
    emailSubject: `New Hire: ${candidate.firstName} ${candidate.lastName}`,
    emailBody: `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> has been hired and onboarding has started.</p>`,
  }).catch((err) => console.error("[candidates] New hire notification error:", err));

  revalidatePath("/cv");
  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/onboarding");

  return { employee, taskCount: resolvedTasks.length };
}

export async function getPositions() {
  return db.position.findMany({
    include: {
      department: true,
      _count: { select: { candidates: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPosition(data: {
  title: string;
  departmentId?: string;
  description?: string;
  requirements?: string;
  salary?: string;
  location?: string;
  type?: string;
  published?: boolean;
  postToJobing?: boolean;
  postToBreezy?: boolean;
  breezyTitleOverride?: string | null;
}) {
  const { postToJobing, postToBreezy, breezyTitleOverride, ...positionData } = data;
  const position = await db.position.create({ data: positionData });

  // Persist Breezy title override for future re-posts. Only store when non-empty
  // and different from the default position title.
  const defaultTitle = data.title.trim();
  const breezyOverride = breezyTitleOverride?.trim() || null;
  if (breezyOverride && breezyOverride !== defaultTitle) {
    await db.positionBoardPosting.upsert({
      where: { positionId_board: { positionId: position.id, board: "BREEZY" } },
      create: { positionId: position.id, board: "BREEZY", status: "NOT_POSTED", titleOverride: breezyOverride },
      update: { titleOverride: breezyOverride },
    });
  }

  let departmentName: string | undefined;
  if (data.departmentId) {
    const dept = await db.department.findUnique({ where: { id: data.departmentId }, select: { name: true } });
    if (dept) departmentName = dept.name;
  }

  if (postToJobing) {
    try {
      const { postJobToJobing } = await import("@/lib/platform-sync/clients/jobing");
      const result = await postJobToJobing({
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        salary: data.salary,
        departmentName,
      });
      if (result.jobId) {
        await db.position.update({ where: { id: position.id }, data: { jobingJobId: result.jobId } });
      }
    } catch (err) {
      console.error("[createPosition] Jobing posting failed:", err);
    }
  }

  const postingErrors: string[] = [];

  // Mirror to Breezy HR only when the user opts in. Always publish — Breezy
  // syndicates to LinkedIn and Indeed automatically.
  if (postToBreezy) {
   try {
    const breezyPlatform = await db.recruitmentPlatform.findUnique({
      where: { name: "Breezy HR" },
      select: { id: true, accountIdentifier: true },
    });
    if (!breezyPlatform?.accountIdentifier) {
      postingErrors.push("Breezy HR is not configured. Connect it in Settings first.");
    } else {
      const { ensureValidToken } = await import("./platform-sync");
      const tokenResult = await ensureValidToken(breezyPlatform.id);
      if (!tokenResult.valid || !tokenResult.accessToken) {
        console.error("[createPosition] Breezy token invalid:", tokenResult.error);
        postingErrors.push(
          `Breezy HR authentication failed: ${tokenResult.error || "invalid token"}`
        );
      } else {
        const { postJobToBreezy } = await import("@/lib/platform-sync/clients/breezy");
        const [breezyToken] = tokenResult.accessToken.split("::");
        const titleForBreezy = breezyTitleOverride?.trim() || data.title;
        const result = await postJobToBreezy({
          accessToken: breezyToken,
          companyId: breezyPlatform.accountIdentifier,
          title: titleForBreezy,
          description: data.description,
          requirements: data.requirements,
          department: departmentName,
          location: data.location,
          type: data.type,
          salary: data.salary,
          publishState: "published",
        });

        const status: string = result.success
          ? "PUBLISHED"
          : "FAILED";

        await db.positionBoardPosting.upsert({
          where: { positionId_board: { positionId: position.id, board: "BREEZY" } },
          create: {
            positionId: position.id,
            board: "BREEZY",
            status,
            externalId: result.positionId ?? null,
            lastError: result.success ? null : result.error ?? "Failed",
            titleOverride: titleForBreezy === data.title ? null : titleForBreezy,
          },
          update: {
            status,
            externalId: result.positionId ?? null,
            lastError: result.success ? null : result.error ?? "Failed",
          },
        });

        if (!result.success) {
          console.error("[createPosition] Breezy posting failed:", result.error);
          postingErrors.push(`Breezy HR: ${result.error || "failed to post"}`);
        }
      }
    }
   } catch (err) {
    console.error("[createPosition] Breezy posting error:", err);
    postingErrors.push("Breezy HR: unexpected error");
   }
  }

  revalidatePath("/cv");
  return {
    id: position.id,
    title: position.title,
    postingErrors,
  };
}

export async function postPositionToBreezy(
  positionId: string
): Promise<{ success: boolean; error?: string }> {
  const position = await db.position.findUnique({
    where: { id: positionId },
    include: { department: true },
  });
  if (!position) return { success: false, error: "Position not found" };

  const breezyPlatform = await db.recruitmentPlatform.findUnique({
    where: { name: "Breezy HR" },
    select: { id: true, accountIdentifier: true },
  });
  if (!breezyPlatform?.accountIdentifier) {
    return { success: false, error: "Breezy HR not connected. Go to Settings to connect." };
  }

  const { ensureValidToken } = await import("./platform-sync");
  const tokenResult = await ensureValidToken(breezyPlatform.id);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    return { success: false, error: tokenResult.error || "Breezy HR auth failed" };
  }

  const [breezyToken] = tokenResult.accessToken.split("::");
  const { postJobToBreezy } = await import("@/lib/platform-sync/clients/breezy");
  const result = await postJobToBreezy({
    accessToken: breezyToken,
    companyId: breezyPlatform.accountIdentifier,
    title: position.title,
    description: position.description || undefined,
    requirements: position.requirements || undefined,
    department: position.department?.name,
    location: position.location || undefined,
    type: position.type || undefined,
    salary: position.salary || undefined,
    publishState: "published",
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/cv");
  return { success: true };
}

export async function updatePosition(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    requirements?: string | null;
    salary?: string | null;
    location?: string | null;
    type?: string | null;
    departmentId?: string | null;
  }
) {
  const position = await db.position.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.requirements !== undefined ? { requirements: data.requirements } : {}),
      ...(data.salary !== undefined ? { salary: data.salary } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
    },
  });
  revalidatePath("/cv");
  revalidatePath("/careers");
  return position;
}

export async function updatePositionStatus(
  id: string,
  status: "OPEN" | "CLOSED" | "FILLED"
) {
  const previous = await db.position.findUnique({ where: { id }, select: { status: true } });
  const position = await db.position.update({
    where: { id },
    data: { status },
  });

  // If the position just transitioned to a "no longer accepting" state, close
  // it on every board (Breezy, careers, etc.) so we stop pulling in applicants.
  const wasOpen = previous?.status === "OPEN";
  const nowClosed = status === "CLOSED" || status === "FILLED";
  if (wasOpen && nowClosed) {
    const { closeAllBoardsForPosition } = await import("./board-postings");
    await closeAllBoardsForPosition(id);
  }

  revalidatePath("/cv");
  return position;
}

export async function clonePosition(id: string): Promise<{ success: boolean; newId?: string; error?: string }> {
  const { requireAuth } = await import("@/lib/auth-helpers");
  await requireAuth();
  const source = await db.position.findUnique({ where: { id } });
  if (!source) return { success: false, error: "Position not found" };
  try {
    const clone = await db.position.create({
      data: {
        title: source.title,
        departmentId: source.departmentId,
        description: source.description,
        requirements: source.requirements,
        salary: source.salary,
        location: source.location,
        type: source.type,
        status: "OPEN",
        published: false,
      },
    });
    revalidatePath("/cv");
    return { success: true, newId: clone.id };
  } catch (err) {
    console.error("[clonePosition]", err);
    return { success: false, error: err instanceof Error ? err.message : "Clone failed" };
  }
}

export async function deletePosition(id: string): Promise<{ success: boolean; error?: string }> {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user.role !== "SUPER_ADMIN") {
    return { success: false, error: "Only super admins can delete positions" };
  }
  try {
    // Detach candidates from this position instead of deleting them
    await db.candidate.updateMany({ where: { positionId: id }, data: { positionId: null } });
    // CandidateApplication.positionId is SetNull in the schema, so Prisma handles it.
    // Interviews cascade via Position relation. Jobing link is just a string field on Position.
    await db.position.delete({ where: { id } });
    revalidatePath("/cv");
    return { success: true };
  } catch (err) {
    console.error("[deletePosition]", err);
    return { success: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function assignCandidateToPosition(
  candidateId: string,
  positionId: string,
  recruiterId?: string
) {
  const data: Record<string, unknown> = { positionId, inPipeline: true, status: "NEW" };
  if (recruiterId) data.recruiterId = recruiterId;
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });
  revalidatePath("/cv");
  return candidate;
}

export async function findMatchingCandidates(keywords: string[]) {
  if (keywords.length === 0) return [];
  const orConditions = keywords.flatMap((kw) => [
    { skills: { contains: kw, mode: "insensitive" as const } },
    { experience: { contains: kw, mode: "insensitive" as const } },
    { resumeText: { contains: kw, mode: "insensitive" as const } },
    { notes: { contains: kw, mode: "insensitive" as const } },
  ]);
  return db.candidate.findMany({
    where: {
      inPipeline: false,
      status: { notIn: ["HIRED", "REJECTED"] },
      OR: orConditions,
    },
    include: { position: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getAllCandidatesForDatabase() {
  return db.candidate.findMany({
    include: { position: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCandidate(id: string) {
  await db.interview.deleteMany({ where: { candidateId: id } });
  await db.candidate.delete({ where: { id } });
  revalidatePath("/cv");
}

export async function sendOfferLetter(
  candidateId: string,
  offerDocUrl: string
): Promise<{ success: boolean; error?: string }> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: true },
  });
  if (!candidate) return { success: false, error: "Candidate not found" };

  try {
    const { createStandaloneSigningRequest } = await import("@/lib/actions/signing");
    const { getCompanySettings } = await import("@/lib/actions/company-settings");
    const settings = await getCompanySettings();
    const positionTitle = candidate.position?.title || "the position";

    // Create a signing request for the candidate (email is sent automatically)
    await createStandaloneSigningRequest({
      candidateId: candidate.id,
      signerName: `${candidate.firstName} ${candidate.lastName}`,
      signerEmail: candidate.email,
      documentUrl: offerDocUrl,
      documentName: `Offer Letter — ${positionTitle} at ${settings.companyName}`,
    });

    await db.candidate.update({
      where: { id: candidateId },
      data: { offerDocUrl, offerSentAt: new Date() },
    });

    revalidatePath("/cv");
    return { success: true };
  } catch (err) {
    console.error("[candidates] Failed to send offer letter:", err);
    return { success: false, error: "Failed to send offer email" };
  }
}

export async function pullCandidateToRecruitment(
  candidateId: string,
  positionId?: string
) {
  const data: Record<string, unknown> = {
    inPipeline: true,
    status: "NEW",
  };
  if (positionId) data.positionId = positionId;

  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });
  revalidatePath("/cv");
  return candidate;
}
