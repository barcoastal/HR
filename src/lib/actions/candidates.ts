"use server";

import { db } from "@/lib/db";
import type { CandidateStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendOnboardingEmail, sendWelcomeEmail } from "@/lib/email";
import { getRecruiterScope, assertCandidateAccess } from "@/lib/auth-helpers";

export async function getCandidates(filters?: {
  status?: CandidateStatus;
  positionId?: string;
  search?: string;
  inPipeline?: boolean;
  recruiterId?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.positionId) where.positionId = filters.positionId;
  if (filters?.inPipeline !== undefined) where.inPipeline = filters.inPipeline;
  if (filters?.recruiterId) where.recruiterId = filters.recruiterId;

  // Recruiters only see candidates assigned to them. Admins/SUPER_ADMIN/HR
  // see everything. Overrides whatever caller passed in.
  const scope = await getRecruiterScope();
  if (scope) where.recruiterId = scope;
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { resumeText: { contains: filters.search, mode: "insensitive" } },
      { skills: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Pipeline cards never render resumeText content (only a "has resume" badge),
  // and the full position object is over-fetched — title is the only field used.
  // Dropping these turns a multi-MB response into something tiny.
  return db.candidate.findMany({
    where,
    omit: { resumeText: true },
    include: { position: { select: { title: true } } },
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

  // DNC block: any prior candidate flagged Do-Not-Call (by phone or email)
  // can't be re-added. Stops Indeed/sync from resurrecting rejects.
  const { findDoNotCallMatch } = await import("./candidate-applications");
  const dncHit = await findDoNotCallMatch(data.phone, data.email);
  if (dncHit) {
    throw new Error(
      `${dncHit.firstName} ${dncHit.lastName} is on the Do Not Call list and cannot be re-added.`,
    );
  }

  // Pre-check email so the UI can show a friendly duplicate message instead
  // of a generic Prisma unique-constraint error or a Server Components render
  // crash when the page refetches.
  const existingByEmail = await db.candidate.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existingByEmail) {
    throw new Error(`A candidate with email ${data.email} already exists.`);
  }

  // Phone-based soft merge: if a candidate already exists with the same
  // normalized phone (last 10 digits) AND the same name, treat this as the
  // same person re-applying rather than creating a separate row. We bump
  // applicationCount, record a new application, and backfill any missing
  // fields on the existing row. Different person same phone (family, etc.)
  // is rare and recoverable via the duplicates UI.
  const normPhone = (data.phone || "").replace(/\D/g, "").slice(-10);
  if (normPhone.length === 10) {
    // Match by phone ALONE (digit-only) — not by name. Indeed often sends
    // scrambled / anonymized names on the same candidate ("Mau Ricestevena"
    // one day, "Maurice Stevens" another), so requiring a name match
    // missed obvious phone duplicates and let dupes pile up every sync.
    // Use the last-4 digits as a cheap Postgres-side filter (those 4 digits
    // always survive formatting), then compare digit-only in JS.
    const last4 = normPhone.slice(-4);
    const candidatesWithPhone = await db.candidate.findMany({
      where: { phone: { contains: last4 } },
      select: { id: true, firstName: true, lastName: true, phone: true, resumeUrl: true, resumeText: true, linkedinUrl: true, skills: true, experience: true, notes: true, source: true, positionId: true, jobAppliedTo: true },
    });
    const sameNamePhone = candidatesWithPhone.find(
      (r) => (r.phone || "").replace(/\D/g, "").slice(-10) === normPhone,
    );
    if (sameNamePhone) {
      // Backfill missing fields.
      const fill: Record<string, unknown> = {};
      if (!sameNamePhone.resumeUrl && data.resumeUrl) fill.resumeUrl = data.resumeUrl;
      if (!sameNamePhone.resumeText && data.resumeText) fill.resumeText = data.resumeText;
      if (!sameNamePhone.linkedinUrl && data.linkedinUrl) fill.linkedinUrl = data.linkedinUrl;
      if (!sameNamePhone.experience && data.experience) fill.experience = data.experience;
      if (!sameNamePhone.notes && data.notes) fill.notes = data.notes;
      if (!sameNamePhone.source && data.source) fill.source = data.source;
      if (!sameNamePhone.positionId && data.positionId) fill.positionId = data.positionId;
      if (!sameNamePhone.jobAppliedTo && data.jobAppliedTo) fill.jobAppliedTo = data.jobAppliedTo;
      if (skills.length > 0) {
        try {
          const existingSkills: string[] = sameNamePhone.skills ? JSON.parse(sameNamePhone.skills) : [];
          const merged = Array.from(new Set([...existingSkills, ...skills]));
          if (merged.length > existingSkills.length) fill.skills = JSON.stringify(merged);
        } catch {
          fill.skills = JSON.stringify(skills);
        }
      }
      if (inPipeline) fill.inPipeline = true;
      if (Object.keys(fill).length > 0) {
        await db.candidate.update({ where: { id: sameNamePhone.id }, data: fill });
      }

      // Record the application against the existing candidate.
      const { recordApplication } = await import("./candidate-applications");
      const positionName = data.jobAppliedTo
        || (data.positionId ? (await db.position.findUnique({ where: { id: data.positionId }, select: { title: true } }))?.title || "Unknown" : "Unknown");
      await recordApplication({
        candidateId: sameNamePhone.id,
        positionId: data.positionId ?? null,
        positionName,
        source: data.source ?? null,
        resumeUrl: data.resumeUrl ?? null,
      });

      revalidatePath("/cv");
      const reused = await db.candidate.findUnique({ where: { id: sameNamePhone.id } });
      return reused!;
    }
  }

  const candidate = await db.candidate.create({
    data: {
      ...rest,
      skills: JSON.stringify(skills),
      inPipeline,
    },
  });

  // Notify the recruiter if one was assigned at creation
  if (data.recruiterId) {
    await notifyRecruiterAssigned(candidate.id);
  }

  revalidatePath("/cv");
  return candidate;
}

async function notifyRecruiterAssigned(candidateId: string) {
  try {
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId },
      include: { position: { select: { title: true } } },
    });
    if (!candidate?.recruiterId) return;
    const recruiter = await db.employee.findUnique({
      where: { id: candidate.recruiterId },
      select: { id: true, email: true, firstName: true },
    });
    if (!recruiter) return;
    const fullName = `${candidate.firstName} ${candidate.lastName}`;
    const positionTitle = candidate.position?.title || candidate.jobAppliedTo || "a position";
    const baseUrl = process.env.NEXTAUTH_URL || "";

    // Direct in-app notification — bypasses NotificationRule toggles so the
    // recruiter always sees the assignment even if global rules are off.
    await db.notification.create({
      data: {
        recipientId: recruiter.id,
        type: "RECRUITER_ASSIGNED",
        message: `You were assigned as recruiter for ${fullName}`,
        link: "/my-candidates",
      },
    });

    // Direct email — same reasoning. Failure here doesn't roll back the assignment.
    if (recruiter.email) {
      try {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(
          recruiter.email,
          `Assigned: ${fullName} (${positionTitle})`,
          `<p>Hi ${recruiter.firstName},</p><p>You've been assigned as the recruiter for <strong>${fullName}</strong> on <strong>${positionTitle}</strong>.</p><p><a href="${baseUrl}/my-candidates">Open My Candidates</a></p>`
        );
      } catch (emailErr) {
        console.error("[recruiter-assigned] email failed:", emailErr);
      }
    }
  } catch (err) {
    console.error("[recruiter-assigned] notification failed:", err);
  }
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
  startDate?: string | Date | null,
  options?: { positionTitle?: string; onlyDocIds?: string[] }
) {
  if (!DOC_STAGES.includes(status) || !candidate.email) return;

  try {
    const { getStageDocuments } = await import("@/lib/actions/stage-documents");
    const { fillPdfPlaceholders } = await import("@/lib/stage-document-utils");
    const { sendEmailWithAttachments } = await import("@/lib/email");
    const { getCompanySettings } = await import("@/lib/actions/company-settings");
    const [allDocs, settings] = await Promise.all([
      getStageDocuments(status),
      getCompanySettings(),
    ]);
    // Manual resend can target a specific subset of the stage's documents.
    const docs = options?.onlyDocIds
      ? allDocs.filter((d) => options.onlyDocIds!.includes(d.id))
      : allDocs;
    console.log(`[stage-docs] Found ${docs.length} docs for stage ${status}, candidate ${candidate.email}`);

    const position = options?.positionTitle
      ? { title: options.positionTitle }
      : candidate.positionId
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
    const missingPdf = docs.filter((d) => !d.pdfData);
    if (missingPdf.length > 0) {
      console.warn(`[stage-docs] ${missingPdf.length} doc(s) for stage ${status} have NO uploaded PDF and will be skipped: ${missingPdf.map((d) => d.name).join(", ")}`);
    }
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
     try {
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
     } catch (e) {
       console.error(`[stage-docs] FAILED signing doc "${doc.name}", skipping and continuing with the rest:`, e);
     }
    }

    // Handle docs that require filling — upload filled PDF (with placeholders pre-filled), create fill request
    for (const doc of fillDocs) {
     try {
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
     } catch (e) {
       console.error(`[stage-docs] FAILED fill doc "${doc.name}", skipping and continuing with the rest:`, e);
     }
    }

    // Handle attachment-only docs
    if (attachmentDocs.length > 0) {
      const attachments = [];
      for (const doc of attachmentDocs) {
       try {
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
       } catch (e) {
         console.error(`[stage-docs] FAILED attachment doc "${doc.name}", skipping and continuing with the rest:`, e);
       }
      }
      console.log(`[stage-docs] Sending ${attachments.length} attachments to ${candidate.email}`);
      if (attachments.length > 0) {
        await sendEmailWithAttachments(
          candidate.email,
          `Documents: ${STAGE_LABELS[status] || status}`,
          `<p>Hi ${candidate.firstName},</p>
          <p>Please find your ${STAGE_LABELS[status] || status} documents attached.</p>
          <p>${attachments.length} document${attachments.length > 1 ? "s" : ""} attached.</p>`,
          attachments
        );
      }
    }

    console.log(`[stage-docs] All docs processed for ${candidate.email} (${attachmentDocs.length} attached, ${signingDocs.length} signing)`);
  } catch (err) {
    console.error(`[stage-docs] Failed to send docs for ${status} to ${candidate.email}:`, err);
  }
}

/**
 * Manually (re)send selected stage documents to an existing employee, for when
 * someone did not receive theirs. Placeholder data is built from the employee
 * record; hourly rate and exact position live on the original candidate, so
 * those placeholders fall back ({{position}} uses the employee's job title).
 */
export async function resendStageDocuments(
  employeeId: string,
  stage: string,
  docIds: string[]
): Promise<{ success: boolean; sent?: number; error?: string }> {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Not authorized" };
  }
  if (!docIds || docIds.length === 0) return { success: false, error: "No documents selected" };

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { success: false, error: "Employee not found" };
  if (!employee.email) return { success: false, error: "Employee has no email on file" };

  const candidateObj = {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    hourlyRate: null,
    positionId: null,
  };

  await sendStageDocumentsEmail(stage, candidateObj, employee.id, employee.startDate, {
    positionTitle: employee.jobTitle,
    onlyDocIds: docIds,
  });

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "stage_docs.manual_resend",
    entityType: "employee",
    entityId: employeeId,
    details: { stage, docIds, count: docIds.length, by: session.user?.email },
  });

  revalidatePath("/pre-onboarding");
  revalidatePath("/onboarding");
  revalidatePath(`/people/${employeeId}`);
  return { success: true, sent: docIds.length };
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus
) {
  await assertCandidateAccess(id);
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) throw new Error("Candidate not found");

  const previousStatus = candidate.status;
  const data: Record<string, unknown> = { status };
  if (status === "HIRED") data.hiredAt = new Date();

  const updated = await db.candidate.update({ where: { id }, data });

  if (previousStatus !== status) {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.status.changed",
      entityType: "candidate",
      entityId: id,
      details: {
        name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        from: previousStatus,
        to: status,
      },
    });
  }

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

  // Recruiters: restrict to their assigned candidates.
  const scope = await getRecruiterScope();
  if (scope) andConditions.push({ recruiterId: scope });

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

  // DNC block: drop any row whose phone or email matches a Do-Not-Call
  // candidate before we do anything else. Tracks them in `skipped`.
  const { findDoNotCallMatch } = await import("./candidate-applications");
  const dncFilter: typeof uniqueToCreate = [];
  for (const c of uniqueToCreate) {
    const hit = await findDoNotCallMatch(c.phone, c.email);
    if (hit) {
      skipped.push(`${c.email} (Do Not Call — ${hit.firstName} ${hit.lastName})`);
    } else {
      dncFilter.push(c);
    }
  }

  // Phone-based soft merge — matches by digit-only phone alone (not name)
  // because Indeed sometimes anonymizes names on the same candidate. Cheap
  // Postgres filter on last-4 digits, then digit-only compare in JS.
  const candidatesByPhone = new Map<string, { id: string }>();
  const withValidPhone = dncFilter.filter((c) => (c.phone || "").replace(/\D/g, "").length >= 10);
  if (withValidPhone.length > 0) {
    const last4Set = Array.from(new Set(
      withValidPhone.map((c) => (c.phone || "").replace(/\D/g, "").slice(-4))
    ));
    const phoneCandidates = await db.candidate.findMany({
      where: {
        OR: last4Set.map((last4) => ({ phone: { contains: last4 } })),
      },
      select: { id: true, phone: true },
    });
    for (const existing of phoneCandidates) {
      const normP = (existing.phone || "").replace(/\D/g, "").slice(-10);
      if (normP.length !== 10) continue;
      candidatesByPhone.set(normP, existing);
    }
  }

  // Partition into rows to insert vs rows to fold onto an existing candidate.
  const insertable: typeof uniqueToCreate = [];
  const reapplications: { existingId: string; row: typeof uniqueToCreate[number] }[] = [];
  for (const c of dncFilter) {
    const normP = (c.phone || "").replace(/\D/g, "").slice(-10);
    if (normP.length === 10) {
      const match = candidatesByPhone.get(normP);
      if (match) {
        reapplications.push({ existingId: match.id, row: c });
        continue;
      }
    }
    insertable.push(c);
  }

  // Record applications + bump applicationCount on the existing rows.
  if (reapplications.length > 0) {
    const { recordApplication } = await import("./candidate-applications");
    for (const ra of reapplications) {
      try {
        await recordApplication({
          candidateId: ra.existingId,
          positionId: null,
          positionName: "Bulk upload",
          source: ra.row.source ?? null,
          resumeUrl: null,
        });
        skipped.push(`${ra.row.email} (merged into existing by phone)`);
      } catch (err) {
        errors.push(`Phone-merge for ${ra.row.email} failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  // Batch create in chunks of 500
  let created = 0;
  const CHUNK_SIZE = 500;

  for (let i = 0; i < insertable.length; i += CHUNK_SIZE) {
    const chunk = insertable.slice(i, i + CHUNK_SIZE);
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
  await assertCandidateAccess(id);
  const existing = await db.candidate.findUnique({ where: { id } });
  const previousStatus = existing?.status;
  const previousRecruiterId = existing?.recruiterId ?? null;

  const { skills, status, ...rest } = data;
  const updateData: Record<string, unknown> = { ...rest };
  if (skills !== undefined) updateData.skills = JSON.stringify(skills);
  if (status !== undefined) {
    updateData.status = status;
    if (status === "HIRED") updateData.hiredAt = new Date();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate = await db.candidate.update({ where: { id }, data: updateData });

  // Notify when recruiter changes to a non-null value
  if (
    data.recruiterId !== undefined &&
    data.recruiterId &&
    data.recruiterId !== previousRecruiterId
  ) {
    await notifyRecruiterAssigned(id);
  }

  // Audit status changes from this path (kanban move + detail-dialog edits both
  // route through here).
  if (status && previousStatus && previousStatus !== status) {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.status.changed",
      entityType: "candidate",
      entityId: id,
      details: {
        name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        from: previousStatus,
        to: status,
      },
    });
  }

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
  await assertCandidateAccess(id);
  const candidate = await db.candidate.update({
    where: { id },
    data: { notes },
  });
  revalidatePath("/cv");
  return candidate;
}

type HireResult =
  | { success: true; employeeId: string; taskCount: number }
  | { success: false; error: string };

export async function hireCandidateAndStartOnboarding(
  candidateId: string,
  options?: { companyEmail?: string; startDate?: string; managerId?: string; skipEmail?: boolean }
): Promise<HireResult> {
  try {
    return await hireInner(candidateId, options);
  } catch (err) {
    // Server Action thrown errors are masked by Next.js in production. Return
    // a plain JSON error so the client dialog can show the real message.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[hire] failed:", err);
    return { success: false, error: message };
  }
}

async function hireInner(
  candidateId: string,
  options?: { companyEmail?: string; startDate?: string; managerId?: string; skipEmail?: boolean }
): Promise<HireResult> {
  await assertCandidateAccess(candidateId);
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

  // Block the hire if an Employee already exists with this email — Prisma's
  // unique constraint would throw a generic P2002 that Next.js then hides in
  // production. Surface a clear message instead.
  const existingEmployee = await db.employee.findUnique({
    where: { email: employeeEmail },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  if (existingEmployee) {
    throw new Error(
      `An employee already exists with email ${employeeEmail} ` +
      `(${existingEmployee.firstName} ${existingEmployee.lastName}, status ${existingEmployee.status}). ` +
      `Use a different company email, or archive the existing employee record first.`
    );
  }

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
    return { success: true, employeeId: employee.id, taskCount: preOnboardingTasks.length };
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
    return { success: true, employeeId: employee.id, taskCount: preOnboardingTasks.length };
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

  // Send PRE_ONBOARDING stage documents (this branch previously sent none)
  await sendStageDocumentsEmail("PRE_ONBOARDING", candidate, employee.id, startDate);

  revalidatePath("/cv");
  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/onboarding");

  return { success: true, employeeId: employee.id, taskCount: resolvedTasks.length };
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

  // Reuse existing Breezy posting if we already created one — otherwise every
  // call would spawn a duplicate position on Breezy.
  const existing = await db.positionBoardPosting.findUnique({
    where: { positionId_board: { positionId, board: "BREEZY" } },
    select: { externalId: true },
  });
  if (existing?.externalId) {
    const { updateBreezyPositionState } = await import("@/lib/platform-sync/clients/breezy");
    const r = await updateBreezyPositionState({
      accessToken: breezyToken,
      companyId: breezyPlatform.accountIdentifier,
      positionId: existing.externalId,
      state: "published",
    });
    if (!r.success) return { success: false, error: r.error };
    await db.positionBoardPosting.update({
      where: { positionId_board: { positionId, board: "BREEZY" } },
      data: { status: "PUBLISHED", lastError: null, lastSyncAt: new Date() },
    });
    revalidatePath("/cv");
    return { success: true };
  }

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

  // Record the new Breezy externalId so a future call republishes instead of
  // creating yet another duplicate.
  await db.positionBoardPosting.upsert({
    where: { positionId_board: { positionId, board: "BREEZY" } },
    create: {
      positionId,
      board: "BREEZY",
      status: "PUBLISHED",
      externalId: result.positionId ?? null,
      lastError: null,
      lastSyncAt: new Date(),
    },
    update: {
      status: "PUBLISHED",
      externalId: result.positionId ?? null,
      lastError: null,
      lastSyncAt: new Date(),
    },
  });

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

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "position.status.changed",
    entityType: "position",
    entityId: id,
    details: { from: previous?.status, to: status, title: position.title },
  });

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
  await assertCandidateAccess(candidateId);
  const previous = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { recruiterId: true },
  });
  const data: Record<string, unknown> = { positionId, inPipeline: true, status: "NEW" };
  if (recruiterId) data.recruiterId = recruiterId;
  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data,
  });

  if (recruiterId && recruiterId !== previous?.recruiterId) {
    await notifyRecruiterAssigned(candidateId);
  }

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
  // Database tab renders thousands of rows; drop resumeText (5-10KB each — was
  // the main cause of 11MB pages) and slim the position relation.
  // Note: client-side search on resumeText is no longer possible; use
  // advancedSearchCandidates for server-side full-text search if needed.
  const scope = await getRecruiterScope();
  return db.candidate.findMany({
    where: scope ? { recruiterId: scope } : undefined,
    omit: { resumeText: true },
    include: { position: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Lightweight count for stat cards — avoids loading rows. */
export async function getTotalCandidateCount() {
  const scope = await getRecruiterScope();
  return db.candidate.count({ where: scope ? { recruiterId: scope } : undefined });
}

export async function deleteCandidate(id: string) {
  await assertCandidateAccess(id);
  const target = await db.candidate.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, email: true, status: true },
  });
  await db.interview.deleteMany({ where: { candidateId: id } });
  await db.candidate.delete({ where: { id } });
  const { audit } = await import("@/lib/audit");
  await audit({
    action: "candidate.deleted",
    entityType: "candidate",
    entityId: id,
    details: target
      ? { name: `${target.firstName} ${target.lastName}`, email: target.email, status: target.status }
      : undefined,
  });
  revalidatePath("/cv");
}

export async function sendOfferLetter(
  candidateId: string,
  offerDocUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCandidateAccess(candidateId);
  } catch {
    return { success: false, error: "Forbidden" };
  }
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
  await assertCandidateAccess(candidateId);
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
