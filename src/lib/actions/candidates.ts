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

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus
) {
  const data: Record<string, unknown> = { status };
  if (status === "HIRED") data.hiredAt = new Date();

  const candidate = await db.candidate.update({ where: { id }, data });
  revalidatePath("/cv");
  return candidate;
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
  let created = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const existing = await db.candidate.findUnique({
        where: { email: candidate.email },
      });

      if (existing) {
        skipped.push(candidate.email);
        continue;
      }

      const skillsArray = candidate.skills
        ? candidate.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      await db.candidate.create({
        data: {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          skills: JSON.stringify(skillsArray),
          experience: candidate.experience,
          source: candidate.source,
          linkedinUrl: candidate.linkedinUrl,
          notes: candidate.notes,
        },
      });

      created++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to import ${candidate.email}: ${message}`);
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
    status?: CandidateStatus;
  }
) {
  const { skills, status, ...rest } = data;
  const updateData: Record<string, unknown> = { ...rest };
  if (skills !== undefined) updateData.skills = JSON.stringify(skills);
  if (status !== undefined) {
    updateData.status = status;
    if (status === "HIRED") updateData.hiredAt = new Date();
  }
  const candidate = await db.candidate.update({ where: { id }, data: updateData });
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

export async function hireCandidateAndStartOnboarding(candidateId: string) {
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

  const employee = await db.employee.create({
    data: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      jobTitle: candidate.position?.title || "New Hire",
      departmentId: candidate.position?.departmentId || null,
      startDate: new Date(),
      anniversaryDate: new Date(),
      bio: bio || null,
      status: "ONBOARDING",
    },
  });

  // Create user account and send welcome email
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const existingUser = await db.user.findUnique({ where: { email: candidate.email } });
  if (!existingUser) {
    await db.user.create({
      data: {
        email: candidate.email,
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
    to: candidate.email,
    role: "Employee",
    loginUrl: `${baseUrl}/login`,
  });

  // Resolve and create onboarding tasks
  const { resolveOnboardingTasks } = await import("./onboarding-resolution");
  const { createSigningRequest } = await import("./signing");
  const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");

  const resolvedTasks = await resolveOnboardingTasks(
    candidate.position?.departmentId || null,
    candidate.position?.title || null
  );

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

    // Handle document actions
    if (task.documentAction === "SEND" && task.sendEmail && task.emailSubject && task.emailBody) {
      sendOnboardingEmail({
        to: candidate.email,
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
        to: candidate.email,
        firstName: candidate.firstName,
        documentName: task.documentName,
        signingUrl: `${baseUrl}/sign/${signingReq.token}`,
      });
    } else if (task.sendEmail && task.emailSubject && task.emailBody) {
      sendOnboardingEmail({
        to: candidate.email,
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
}) {
  const position = await db.position.create({ data });
  revalidatePath("/cv");
  return position;
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
