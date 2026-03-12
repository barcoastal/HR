"use server";

import { db } from "@/lib/db";
import type { ChecklistType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function createChecklist(name: string, type: ChecklistType, departmentId?: string) {
  const checklist = await db.onboardingChecklist.create({
    data: { name, type, departmentId: departmentId || null },
  });
  revalidatePath("/settings");
  return checklist;
}

export async function deleteChecklist(id: string) {
  await db.onboardingChecklist.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addChecklistItem(
  checklistId: string,
  title: string,
  description?: string,
  assigneeId?: string,
  dueDay?: number,
  sendEmail?: boolean,
  emailSubject?: string,
  emailBody?: string,
  documentUrl?: string,
  documentName?: string
) {
  const maxOrder = await db.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const item = await db.checklistItem.create({
    data: {
      checklistId,
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      dueDay: dueDay ?? null,
      order: (maxOrder?.order ?? -1) + 1,
      sendEmail: sendEmail ?? false,
      emailSubject: emailSubject || null,
      emailBody: emailBody || null,
      documentUrl: documentUrl || null,
      documentName: documentName || null,
    },
  });
  revalidatePath("/settings");
  return item;
}

export async function updateChecklistItem(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    dueDay?: number | null;
    sendEmail?: boolean;
    emailSubject?: string | null;
    emailBody?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
  }
) {
  const item = await db.checklistItem.update({ where: { id }, data });
  revalidatePath("/settings");
  return item;
}

export async function deleteChecklistItem(id: string) {
  await db.checklistItem.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function createOverrideChecklist(
  departmentId: string,
  jobTitleId: string
) {
  const jobTitle = await db.jobTitle.findUnique({ where: { id: jobTitleId } });
  if (!jobTitle) throw new Error("Job title not found");

  const existing = await db.onboardingChecklist.findFirst({
    where: { departmentId, jobTitleId, isOverride: true, type: "ONBOARDING" },
  });
  if (existing) return existing;

  const checklist = await db.onboardingChecklist.create({
    data: {
      name: `${jobTitle.name} Override`,
      type: "ONBOARDING",
      departmentId,
      jobTitleId,
      isOverride: true,
    },
  });
  revalidatePath("/settings");
  return checklist;
}

export async function deleteOverrideChecklist(id: string) {
  await db.onboardingChecklist.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addExclusion(overrideChecklistId: string, excludedItemId: string) {
  await db.checklistOverrideExclusion.create({
    data: { overrideChecklistId, excludedItemId },
  });
  revalidatePath("/settings");
}

export async function removeExclusion(overrideChecklistId: string, excludedItemId: string) {
  await db.checklistOverrideExclusion.deleteMany({
    where: { overrideChecklistId, excludedItemId },
  });
  revalidatePath("/settings");
}

export async function getChecklistsForDepartment(departmentId: string | null) {
  return db.onboardingChecklist.findMany({
    where: {
      type: "ONBOARDING",
      departmentId,
      isOverride: false,
    },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { assignee: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getOverridesForDepartment(departmentId: string) {
  return db.onboardingChecklist.findMany({
    where: {
      type: "ONBOARDING",
      departmentId,
      isOverride: true,
    },
    include: {
      jobTitle: true,
      items: {
        orderBy: { order: "asc" },
        include: { assignee: true },
      },
      exclusions: { include: { excludedItem: true } },
    },
    orderBy: { name: "asc" },
  });
}
