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
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
      { email: { contains: filters.search } },
      { resumeText: { contains: filters.search } },
      { skills: { contains: filters.search } },
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
  HIRED: "Hired",
  REJECTED: "Rejected",
};

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

  // Send stage-change notification emails based on settings
  if (previousStatus !== status) {
    try {
      const { sendEmail } = await import("@/lib/email");
      const { getStageNotifyRecipients, getStageNotifyEmployeeIds } = await import("@/lib/actions/company-settings");
      const recipients = await getStageNotifyRecipients();
      const stageLabel = STAGE_LABELS[status] || status;
      const rateInfo = candidate.hourlyRate
        ? `<p>Hourly rate: <strong>$${candidate.hourlyRate.toFixed(2)}/hr</strong></p>`
        : "";
      const candidateName = `${candidate.firstName} ${candidate.lastName}`;

      // Send to candidate
      if (recipients.includes("candidate") && candidate.email) {
        await sendEmail(
          candidate.email,
          `Application Update: ${stageLabel}`,
          `<p>Hi ${candidate.firstName},</p>
          <p>Your application has been moved to <strong>${stageLabel}</strong>.</p>
          ${rateInfo}
          <p>We'll be in touch with next steps shortly.</p>`
        );
      }

      // Send to recruiter
      if (recipients.includes("recruiter") && candidate.recruiterId) {
        const recruiter = await db.employee.findUnique({ where: { id: candidate.recruiterId }, select: { email: true, firstName: true } });
        if (recruiter?.email) {
          await sendEmail(
            recruiter.email,
            `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
            `<p>Hi ${recruiter.firstName},</p>
            <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
            ${rateInfo}`
          );
        }
      }

      // Send to manager
      if (recipients.includes("manager") && candidate.managerId) {
        const manager = await db.employee.findUnique({ where: { id: candidate.managerId }, select: { email: true, firstName: true } });
        if (manager?.email) {
          await sendEmail(
            manager.email,
            `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
            `<p>Hi ${manager.firstName},</p>
            <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
            ${rateInfo}`
          );
        }
      }

      // Send to additional HR team members
      const extraIds = await getStageNotifyEmployeeIds();
      if (extraIds.length > 0) {
        const extras = await db.employee.findMany({ where: { id: { in: extraIds } }, select: { email: true, firstName: true } });
        for (const emp of extras) {
          if (emp.email) {
            await sendEmail(
              emp.email,
              `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
              `<p>Hi ${emp.firstName},</p>
              <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
              ${rateInfo}`
            );
          }
        }
      }
    } catch (err) {
      console.error("[candidates] Failed to send stage notification:", err);
    }
  }

  revalidatePath("/cv");
  return updated;
}

export async function searchCandidates(query: string) {
  const candidates = await db.candidate.findMany({
    where: {
      OR: [
        { resumeText: { contains: query } },
        { skills: { contains: query } },
        { firstName: { contains: query } },
        { lastName: { contains: query } },
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
  const candidate = await db.candidate.update({ where: { id }, data: updateData });

  // Send stage-change notification emails if status changed
  if (status && previousStatus && previousStatus !== status) {
    try {
      const { sendEmail } = await import("@/lib/email");
      const { getStageNotifyRecipients, getStageNotifyEmployeeIds } = await import("@/lib/actions/company-settings");
      const recipients = await getStageNotifyRecipients();
      const stageLabel = STAGE_LABELS[status] || status;
      const rate = candidate.hourlyRate;
      const rateInfo = rate
        ? `<p>Hourly rate: <strong>$${rate.toFixed(2)}/hr</strong></p>`
        : "";
      const candidateName = `${candidate.firstName} ${candidate.lastName}`;

      if (recipients.includes("candidate") && candidate.email) {
        await sendEmail(
          candidate.email,
          `Application Update: ${stageLabel}`,
          `<p>Hi ${candidate.firstName},</p>
          <p>Your application has been moved to <strong>${stageLabel}</strong>.</p>
          ${rateInfo}
          <p>We'll be in touch with next steps shortly.</p>`
        );
      }

      if (recipients.includes("recruiter") && candidate.recruiterId) {
        const recruiter = await db.employee.findUnique({ where: { id: candidate.recruiterId }, select: { email: true, firstName: true } });
        if (recruiter?.email) {
          await sendEmail(
            recruiter.email,
            `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
            `<p>Hi ${recruiter.firstName},</p>
            <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
            ${rateInfo}`
          );
        }
      }

      if (recipients.includes("manager") && candidate.managerId) {
        const manager = await db.employee.findUnique({ where: { id: candidate.managerId }, select: { email: true, firstName: true } });
        if (manager?.email) {
          await sendEmail(
            manager.email,
            `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
            `<p>Hi ${manager.firstName},</p>
            <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
            ${rateInfo}`
          );
        }
      }

      // Send to additional HR team members
      const extraIds = await getStageNotifyEmployeeIds();
      if (extraIds.length > 0) {
        const extras = await db.employee.findMany({ where: { id: { in: extraIds } }, select: { email: true, firstName: true } });
        for (const emp of extras) {
          if (emp.email) {
            await sendEmail(
              emp.email,
              `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
              `<p>Hi ${emp.firstName},</p>
              <p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>
              ${rateInfo}`
            );
          }
        }
      }
    } catch (err) {
      console.error("[candidates] Failed to send stage notification:", err);
    }
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

    sendWelcomeEmail({
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
      data: { status: "HIRED", inPipeline: false },
    });

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
      sendOnboardingEmail({
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
      sendSigningRequestEmail({
        to: employeeEmail,
        firstName: candidate.firstName,
        documentName: task.documentName,
        signingUrl: `${baseUrl}/sign/${signingReq.token}`,
      });
    } else if (task.sendEmail && task.emailSubject && task.emailBody) {
      sendOnboardingEmail({
        to: employeeEmail,
        subject: task.emailSubject,
        body: task.emailBody,
      });
    }

    // Notify assigned employee
    if (task.assigneeId) {
      const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
      if (assignee) {
        sendTaskAssignmentEmail({
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
  postToJobing?: boolean;
  postToIndeed?: boolean;
  postToBreezy?: boolean;
  breezyChannels?: { linkedin?: boolean; indeed?: boolean };
  linkedInSettings?: { premium?: boolean; remote?: boolean; jobType?: string; experienceLevel?: string };
  indeedSettings?: { sponsored?: boolean; budget?: string; remote?: boolean; jobType?: string };
}) {
  const { postToJobing, postToIndeed, postToBreezy, breezyChannels, linkedInSettings, indeedSettings, ...positionData } = data;
  const position = await db.position.create({ data: positionData });

  let departmentName: string | undefined;
  if (data.departmentId) {
    const dept = await db.department.findUnique({ where: { id: data.departmentId }, select: { name: true } });
    if (dept) departmentName = dept.name;
  }

  if (postToJobing) {
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
  }

  if (postToIndeed) {
    const { postJobToIndeed } = await import("@/lib/platform-sync/clients/indeed");
    const indeedPlatform = await db.recruitmentPlatform.findUnique({
      where: { name: "Indeed" },
      select: { accountIdentifier: true },
    });
    if (indeedPlatform?.accountIdentifier) {
      await postJobToIndeed({
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        salary: data.salary,
        departmentName,
        connectionId: indeedPlatform.accountIdentifier,
      });
    }
  }

  if (postToBreezy) {
    const { postJobToBreezy } = await import("@/lib/platform-sync/clients/breezy");
    const { ensureValidToken } = await import("./platform-sync");
    const breezyPlatform = await db.recruitmentPlatform.findUnique({
      where: { name: "Breezy HR" },
      select: { id: true, accountIdentifier: true },
    });
    if (breezyPlatform?.accountIdentifier) {
      const tokenResult = await ensureValidToken(breezyPlatform.id);
      if (tokenResult.valid && tokenResult.accessToken) {
        const [breezyToken] = tokenResult.accessToken.split("::");
        await postJobToBreezy({
          accessToken: breezyToken,
          companyId: breezyPlatform.accountIdentifier,
          title: data.title,
          description: data.description,
          requirements: data.requirements,
          department: departmentName,
          salary: data.salary,
        });
      }
    }
  }

  revalidatePath("/cv");
  return position;
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
    salary: position.salary || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  revalidatePath("/cv");
  return { success: true };
}

export async function updatePositionStatus(
  id: string,
  status: "OPEN" | "CLOSED" | "FILLED"
) {
  const position = await db.position.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/cv");
  return position;
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
