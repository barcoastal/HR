"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { CALENDAR_CATEGORIES, isCalendarColor, sanitizeCategoryColors, type CategoryColors } from "@/lib/calendar-colors";

export async function getCalendarCategoryColors(): Promise<CategoryColors> {
  await requireAuth();
  return sanitizeCategoryColors(await db.calendarCategoryColor.findMany({ select: { category: true, color: true } }));
}

/** Admins/HR set one palette colour per calendar category; a missing value restores the built-in colour. */
export async function saveCalendarCategoryColors(colors: Record<string, string | null | undefined>) {
  const session = await requireAuth();
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Only admins and HR can change calendar colors" };
  }
  for (const { id } of CALENDAR_CATEGORIES) {
    const color = colors[id];
    if (isCalendarColor(color)) {
      await db.calendarCategoryColor.upsert({ where: { category: id }, create: { category: id, color }, update: { color } });
    } else {
      await db.calendarCategoryColor.deleteMany({ where: { category: id } });
    }
  }
  revalidatePath("/calendar");
  return { success: true };
}
