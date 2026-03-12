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
