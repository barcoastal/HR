"use server";

import { db } from "@/lib/db";
import type { ChecklistType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function createChecklist(name: string, type: ChecklistType) {
  const checklist = await db.onboardingChecklist.create({ data: { name, type } });
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
  dueDay?: number
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
    },
  });
  revalidatePath("/settings");
  return item;
}

export async function updateChecklistItem(
  id: string,
  data: { title?: string; description?: string | null; assigneeId?: string | null; dueDay?: number | null }
) {
  const item = await db.checklistItem.update({ where: { id }, data });
  revalidatePath("/settings");
  return item;
}

export async function deleteChecklistItem(id: string) {
  await db.checklistItem.delete({ where: { id } });
  revalidatePath("/settings");
}
