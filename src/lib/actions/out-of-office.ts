"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { isAdminAudienceRole, type AudienceViewer } from "@/lib/event-audience";
import { revalidatePath } from "next/cache";

/**
 * Whether `viewer` may see this out-of-office entry.
 *
 * Admin-tier roles (SUPER_ADMIN / ADMIN / HR) see every entry — they need a
 * complete picture of who is out. Everyone else sees only their own entries
 * and the ones whose audience includes them.
 */
function wasSharedWith(
  entry: {
    employeeId: string;
    employee: { managerId: string | null };
    audienceType: string;
    audienceDeptIds: string | null;
    audienceEmployeeIds: string | null;
  },
  viewer: AudienceViewer & { employeeId: string | null }
): boolean {
  // You always see your own entries.
  if (viewer.employeeId && entry.employeeId === viewer.employeeId) return true;
  // A direct manager and HR/admin always have operational visibility.
  if (viewer.employeeId && entry.employee.managerId === viewer.employeeId) return true;
  if (!entry.audienceType || entry.audienceType === "all") return true;
  // Admins/HR see everything, regardless of the chosen audience.
  if (isAdminAudienceRole(viewer.role)) return true;
  if (entry.audienceType === "managers") return viewer.role === "MANAGER";

  try {
    if (entry.audienceType === "departments") {
      const ids: string[] = JSON.parse(entry.audienceDeptIds || "[]");
      return !!viewer.departmentId && ids.includes(viewer.departmentId);
    }
    if (entry.audienceType === "employees") {
      const ids: string[] = JSON.parse(entry.audienceEmployeeIds || "[]");
      return !!viewer.employeeId && ids.includes(viewer.employeeId);
    }
  } catch {
    // Malformed audience JSON — fail closed.
  }
  return false;
}

export type OutOfOfficeAudience = {
  type: "all" | "managers" | "departments" | "employees";
  departmentIds?: string[];
  employeeIds?: string[];
};

export type CreateOutOfOfficeInput = {
  startDate: string;
  endDate: string;
  /** "HH:MM" — omit both for a whole-day entry. */
  startTime?: string;
  endTime?: string;
  type?: "OUT_OF_OFFICE" | "VACATION" | "SICK" | "MEDICAL_APPOINTMENT" | "WORKING_REMOTELY";
  note?: string;
  audience?: OutOfOfficeAudience;
};

/** Parse an optional "HH:MM" time-of-day. Returns null when absent/invalid. */
function parseTime(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Parse a "YYYY-MM-DD" input value as a LOCAL calendar date.
 * `new Date("2026-08-05")` parses as UTC midnight, which lands on the previous
 * day for anyone west of UTC — the date the user picked must not shift.
 */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const SELECT = {
  id: true,
  employeeId: true,
  startDate: true,
  endDate: true,
  type: true,
  note: true,
  audienceType: true,
  audienceDeptIds: true,
  audienceEmployeeIds: true,
  employee: {
    select: { id: true, firstName: true, lastName: true, preferredName: true, jobTitle: true, managerId: true },
  },
} as const;

/** The viewer context used for audience checks. */
async function getViewer(): Promise<AudienceViewer & { employeeId: string | null }> {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId ?? null;
  const role = session.user?.role ?? null;

  const emp = employeeId
    ? await db.employee.findUnique({
        where: { id: employeeId },
        select: { departmentId: true },
      })
    : null;

  return { employeeId, departmentId: emp?.departmentId ?? null, role };
}

export async function createOutOfOffice(input: CreateOutOfOfficeInput) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) {
    return { success: false, error: "Your login isn't linked to an employee record." };
  }

  const start = parseLocalDate(input.startDate);
  const end = parseLocalDate(input.endDate);
  if (!start || !end) {
    return { success: false, error: "Please pick valid dates." };
  }

  // Optional times: whole-day entries span 00:00 → 23:59:59; timed entries
  // use the picked times on the start/end dates.
  const startTime = parseTime(input.startTime);
  const endTime = parseTime(input.endTime);
  const startAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), startTime?.hour ?? 0, startTime?.minute ?? 0);
  const endAt = endTime
    ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), endTime.hour, endTime.minute)
    : new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  if (endAt <= startAt) {
    return { success: false, error: "The end of the entry must be after its start." };
  }

  const audienceType = input.audience?.type ?? "all";
  const allowedTypes = new Set([
    "OUT_OF_OFFICE",
    "VACATION",
    "SICK",
    "MEDICAL_APPOINTMENT",
    "WORKING_REMOTELY",
  ]);
  const type = input.type && allowedTypes.has(input.type) ? input.type : "OUT_OF_OFFICE";

  await db.outOfOffice.create({
    data: {
      employeeId,
      startDate: startAt,
      endDate: endAt,
      type,
      note: input.note?.trim() || null,
      audienceType,
      audienceDeptIds:
        audienceType === "departments" ? JSON.stringify(input.audience?.departmentIds ?? []) : null,
      audienceEmployeeIds:
        audienceType === "employees" ? JSON.stringify(input.audience?.employeeIds ?? []) : null,
    },
  });

  revalidatePath("/calendar");
  revalidatePath("/people");
  revalidatePath("/time-off");
  return { success: true };
}

export async function deleteOutOfOffice(id: string) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";

  const entry = await db.outOfOffice.findUnique({ where: { id }, select: { employeeId: true } });
  if (!entry) return { success: false, error: "That entry no longer exists." };
  if (entry.employeeId !== employeeId && !isAdmin) {
    return { success: false, error: "You can only remove your own out-of-office entries." };
  }

  await db.outOfOffice.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath("/people");
  revalidatePath("/time-off");
  return { success: true };
}

/** Everything the current user has posted, upcoming first. */
export async function getMyOutOfOffice() {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) return [];

  return db.outOfOffice.findMany({
    where: { employeeId, endDate: { gte: new Date() } },
    select: SELECT,
    orderBy: { startDate: "asc" },
  });
}

/**
 * Entries overlapping [from, to] that the current viewer is allowed to see.
 * Audience rules match feed events: "all" is public, otherwise only the listed
 * departments/people, plus the author and admin-tier roles.
 */
export async function getVisibleOutOfOffice(from: Date, to: Date) {
  const viewer = await getViewer();

  const entries = await db.outOfOffice.findMany({
    where: { startDate: { lte: to }, endDate: { gte: from } },
    select: SELECT,
    orderBy: { startDate: "asc" },
  });

  return entries.filter((e) => wasSharedWith(e, viewer));
}

/**
 * Current out-of-office state for a set of employees, audience-filtered for the
 * viewer. Returns a map of employeeId -> entry so list UIs can look up cheaply.
 */
export async function getCurrentOutOfOfficeFor(employeeIds: string[]) {
  if (employeeIds.length === 0) return {};
  const viewer = await getViewer();
  const now = new Date();

  const entries = await db.outOfOffice.findMany({
    where: { employeeId: { in: employeeIds }, startDate: { lte: now }, endDate: { gte: now } },
    select: SELECT,
    orderBy: { endDate: "desc" },
  });

  const map: Record<string, { type: string; note: string | null; endDate: Date }> = {};
  for (const e of entries) {
    if (!wasSharedWith(e, viewer) || map[e.employeeId]) continue;
    map[e.employeeId] = { type: e.type, note: e.note, endDate: e.endDate };
  }
  return map;
}
