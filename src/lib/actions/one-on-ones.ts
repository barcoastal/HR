"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { sendEmailWithAttachments } from "@/lib/email";
import { buildIcsInvite } from "@/lib/ics";
import {
  createOneOnOneEvent,
  updateOneOnOneEvent,
  cancelOneOnOneEvent,
  isCalendarConnected,
} from "@/lib/google-calendar";
import { createOneOnOneEventForUser } from "@/lib/google-calendar-sync";
import type { OneOnOneType, UserRole } from "@/generated/prisma/client";

/**
 * Look up the manager's User and, if they have their own Google Calendar
 * connected, return a userId so we can create the event on their calendar
 * (and they become the organizer). Returns null when the manager hasn't
 * personally connected — callers fall back to the platform-wide connection.
 */
async function getManagerCalendarUserId(managerEmployeeId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { employeeId: managerEmployeeId },
    select: { id: true, googleCalendarSyncEnabled: true, googleCalendarAccessToken: true, googleCalendarRefreshToken: true },
  });
  if (!user) return null;
  if (!user.googleCalendarSyncEnabled) return null;
  if (!user.googleCalendarAccessToken || !user.googleCalendarRefreshToken) return null;
  return user.id;
}

const DEFAULT_TIME = { hour: 10, minute: 0 };
const DEFAULT_DURATION_MIN = 30;

function isManagerOrAbove(role?: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";
}
function isAdmin(role?: UserRole | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

function atDefaultTime(date: Date): Date {
  const d = new Date(date);
  d.setHours(DEFAULT_TIME.hour, DEFAULT_TIME.minute, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + years);
  return r;
}

function nextAnniversaryFrom(reference: Date, today = new Date()): Date {
  // Returns the next occurrence of the month/day from `reference` that is
  // strictly in the future relative to `today`.
  const next = new Date(today.getFullYear(), reference.getMonth(), reference.getDate(), DEFAULT_TIME.hour, DEFAULT_TIME.minute, 0, 0);
  if (next <= today) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

/**
 * Schedule the standard new-hire 1:1 cadence (30d, 90d, 1y) for an employee
 * who has just become ACTIVE. Idempotent — skips any meeting type that is
 * already scheduled.
 */
export async function scheduleNewHireOneOnOnes(employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, managerId: true, startDate: true, status: true },
  });
  if (!employee || !employee.managerId) return;

  const base = atDefaultTime(new Date());
  const targets: { type: OneOnOneType; scheduledAt: Date }[] = [
    { type: "THIRTY_DAY", scheduledAt: addDays(base, 30) },
    { type: "QUARTERLY", scheduledAt: addDays(base, 90) },
    { type: "ANNUAL", scheduledAt: addDays(base, 365) },
  ];

  for (const t of targets) {
    const exists = await db.oneOnOne.findFirst({
      where: { employeeId, type: t.type, status: "SCHEDULED" },
      select: { id: true },
    });
    if (exists) continue;
    const created = await db.oneOnOne.create({
      data: {
        employeeId,
        managerId: employee.managerId,
        scheduledAt: t.scheduledAt,
        type: t.type,
      },
    });
    await autoCreateGoogleEvent(created.id);
  }
}

/**
 * Lazy backfill: ensure every ACTIVE employee with a manager has at least one
 * upcoming ANNUAL 1:1 scheduled. Safe to call repeatedly — it only creates
 * meetings that don't already exist.
 */
export async function ensureAnnualCoverage() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", managerId: { not: null } },
    select: { id: true, managerId: true, startDate: true, anniversaryDate: true },
  });

  for (const e of employees) {
    if (!e.managerId) continue;
    const upcoming = await db.oneOnOne.findFirst({
      where: { employeeId: e.id, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      select: { id: true },
    });
    if (upcoming) continue;
    const reference = e.anniversaryDate || e.startDate;
    if (!reference) continue;
    const created = await db.oneOnOne.create({
      data: {
        employeeId: e.id,
        managerId: e.managerId,
        scheduledAt: nextAnniversaryFrom(reference),
        type: "ANNUAL",
      },
    });
    await autoCreateGoogleEvent(created.id);
  }
}

/**
 * Retroactively create Google Calendar events (with Meet link) for any
 * SCHEDULED 1:1 that is missing one. Covers meetings created before Google
 * Calendar was connected, before auto-create shipped, or where the API call
 * failed. Capped per call so a single page load doesn't burn the API quota.
 */
export async function backfillGoogleEvents(limit = 25) {
  if (!(await isCalendarConnected())) return;
  const missing = await db.oneOnOne.findMany({
    where: {
      status: "SCHEDULED",
      googleEventId: null,
      scheduledAt: { gte: new Date() },
    },
    select: { id: true },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });
  for (const m of missing) {
    await autoCreateGoogleEvent(m.id);
  }
}

export async function listOneOnOnes() {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;

  await ensureAnnualCoverage();
  await backfillGoogleEvents();

  const where = isAdmin(role)
    ? {}
    : role === "MANAGER" && myEmployeeId
      ? { OR: [{ managerId: myEmployeeId }, { employeeId: myEmployeeId }] }
      : myEmployeeId
        ? { employeeId: myEmployeeId }
        : { id: "__none__" };

  return db.oneOnOne.findMany({
    where,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, profilePhoto: true } },
      manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true, profilePhoto: true } },
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
  });
}

export async function getOneOnOne(id: string) {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;

  const m = await db.oneOnOne.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, profilePhoto: true } },
      manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, profilePhoto: true } },
    },
  });
  if (!m) return null;

  const allowed =
    isAdmin(role) ||
    (role === "MANAGER" && (m.managerId === myEmployeeId || m.employeeId === myEmployeeId)) ||
    m.employeeId === myEmployeeId;
  if (!allowed) return null;

  // Past notebook entries for context
  const history = await db.oneOnOne.findMany({
    where: { employeeId: m.employeeId, id: { not: m.id }, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      completedAt: true,
      scheduledAt: true,
      notebookMarkdown: true,
      manager: { select: { firstName: true, lastName: true } },
    },
  });

  return { meeting: m, history };
}

export async function getPastOneOnOnesForEmployee(employeeId: string) {
  return db.oneOnOne.findMany({
    where: { employeeId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function listEligibleEmployeesForCreate() {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;

  if (isAdmin(role)) {
    return db.employee.findMany({
      where: { status: { in: ["ACTIVE", "ONBOARDING"] }, managerId: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }
  if (role === "MANAGER" && myEmployeeId) {
    return db.employee.findMany({
      where: { managerId: myEmployeeId, status: { in: ["ACTIVE", "ONBOARDING"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }
  return [];
}

export async function createOneOnOne(input: {
  employeeId: string;
  type: OneOnOneType;
  scheduledAt: Date;
}) {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;

  if (!isManagerOrAbove(role)) {
    return { success: false, error: "Forbidden" };
  }

  const employee = await db.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, managerId: true, status: true },
  });
  if (!employee) return { success: false, error: "Employee not found" };
  if (!employee.managerId) {
    return { success: false, error: "Employee has no assigned manager" };
  }

  // Managers can only schedule for their own direct reports.
  if (!isAdmin(role) && employee.managerId !== myEmployeeId) {
    return { success: false, error: "You can only schedule 1:1s for your direct reports" };
  }

  const created = await db.oneOnOne.create({
    data: {
      employeeId: employee.id,
      managerId: employee.managerId,
      scheduledAt: input.scheduledAt,
      type: input.type,
    },
  });

  await autoCreateGoogleEvent(created.id);

  revalidatePath("/one-on-ones");
  revalidatePath(`/people/${employee.id}`);
  return { success: true, id: created.id };
}

export async function getNextOneOnOneForEmployee(employeeId: string) {
  return db.oneOnOne.findFirst({
    where: { employeeId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    include: {
      manager: { select: { firstName: true, lastName: true } },
    },
  });
}

async function assertCanEdit(meetingId: string) {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;
  const m = await db.oneOnOne.findUnique({ where: { id: meetingId }, select: { managerId: true } });
  if (!m) throw new Error("Not found");
  if (!isAdmin(role) && m.managerId !== myEmployeeId) throw new Error("Forbidden");
  return m;
}

export async function updateNotebook(meetingId: string, notebookMarkdown: string) {
  await assertCanEdit(meetingId);
  await db.oneOnOne.update({
    where: { id: meetingId },
    data: { notebookMarkdown },
  });
  revalidatePath("/one-on-ones");
  revalidatePath(`/one-on-ones/${meetingId}`);
  return { success: true };
}

export async function updateMeetingLink(meetingId: string, meetingLink: string | null) {
  await assertCanEdit(meetingId);
  await db.oneOnOne.update({
    where: { id: meetingId },
    data: { meetingLink: meetingLink?.trim() || null },
  });
  revalidatePath("/one-on-ones");
  revalidatePath(`/one-on-ones/${meetingId}`);
  return { success: true };
}

export async function reschedule(meetingId: string, newDate: Date) {
  await assertCanEdit(meetingId);
  const updated = await db.oneOnOne.update({
    where: { id: meetingId },
    data: { scheduledAt: newDate },
  });

  // Mirror the change to the Google event so attendees are notified.
  if (updated.googleEventId) {
    try {
      await updateOneOnOneEvent({
        googleEventId: updated.googleEventId,
        startTime: newDate,
        durationMinutes: DEFAULT_DURATION_MIN,
      });
    } catch (err) {
      console.error("[one-on-one] Failed to update Google event:", err);
    }
  }

  revalidatePath("/one-on-ones");
  revalidatePath(`/one-on-ones/${meetingId}`);
  return { success: true };
}

export async function cancelMeeting(meetingId: string) {
  await assertCanEdit(meetingId);
  const cancelled = await db.oneOnOne.update({
    where: { id: meetingId },
    data: { status: "CANCELLED" },
  });

  if (cancelled.googleEventId) {
    try {
      await cancelOneOnOneEvent(cancelled.googleEventId);
      await db.oneOnOne.update({
        where: { id: meetingId },
        data: { googleEventId: null },
      });
    } catch (err) {
      console.error("[one-on-one] Failed to cancel Google event:", err);
    }
  }

  revalidatePath("/one-on-ones");
  return { success: true };
}

export async function markComplete(meetingId: string) {
  await assertCanEdit(meetingId);
  const meeting = await db.oneOnOne.update({
    where: { id: meetingId },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: {
      employee: { select: { id: true, anniversaryDate: true, startDate: true, managerId: true } },
    },
  });

  // Auto-create the next ANNUAL on the employee's next anniversary, if they
  // still have a manager and don't already have an upcoming meeting.
  if (meeting.employee.managerId) {
    const upcoming = await db.oneOnOne.findFirst({
      where: { employeeId: meeting.employeeId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      select: { id: true },
    });
    if (!upcoming) {
      const reference = meeting.employee.anniversaryDate || meeting.employee.startDate;
      if (reference) {
        const created = await db.oneOnOne.create({
          data: {
            employeeId: meeting.employeeId,
            managerId: meeting.employee.managerId,
            scheduledAt: nextAnniversaryFrom(reference),
            type: "ANNUAL",
          },
        });
        await autoCreateGoogleEvent(created.id);
      }
    }
  }

  revalidatePath("/one-on-ones");
  revalidatePath(`/one-on-ones/${meetingId}`);
  return { success: true };
}

const TYPE_LABEL: Record<OneOnOneType, string> = {
  THIRTY_DAY: "30-Day Check-In",
  QUARTERLY: "Quarterly Review",
  ANNUAL: "Annual Review",
};

/**
 * Create a Google Calendar event (with Meet link) for a freshly-scheduled 1:1.
 * Fail-soft: any error is logged but does not throw — the OneOnOne still
 * exists in the DB and the event can be created later via sendInvite().
 */
async function autoCreateGoogleEvent(oneOnOneId: string) {
  const m = await db.oneOnOne.findUnique({
    where: { id: oneOnOneId },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true } },
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!m || m.googleEventId) return;
  const summary = `${TYPE_LABEL[m.type]} — ${m.employee.firstName} ${m.employee.lastName} & ${m.manager.firstName} ${m.manager.lastName}`;
  const description = "1:1 Performance Review";

  // Prefer the manager's own Google Calendar so they're the organizer.
  const managerUserId = await getManagerCalendarUserId(m.managerId);
  if (managerUserId) {
    try {
      const { eventId, meetLink } = await createOneOnOneEventForUser(managerUserId, {
        summary,
        description,
        startTime: m.scheduledAt,
        durationMinutes: DEFAULT_DURATION_MIN,
        employeeEmail: m.employee.email,
        oneOnOneId: m.id,
      });
      await db.oneOnOne.update({
        where: { id: m.id },
        data: { googleEventId: eventId || null, meetingLink: meetLink || null },
      });
      return;
    } catch (err) {
      console.error("[one-on-one] manager-calendar create failed, trying shared:", err);
      // fall through to shared connection
    }
  }

  // Fallback: shared platform-wide Google Calendar (whoever connected it).
  if (!(await isCalendarConnected())) return;
  try {
    const { eventId, meetLink } = await createOneOnOneEvent({
      summary,
      description,
      startTime: m.scheduledAt,
      durationMinutes: DEFAULT_DURATION_MIN,
      managerEmail: m.manager.email,
      employeeEmail: m.employee.email,
      oneOnOneId: m.id,
    });
    await db.oneOnOne.update({
      where: { id: m.id },
      data: { googleEventId: eventId || null, meetingLink: meetLink || null },
    });
  } catch (err) {
    console.error("[one-on-one] auto-create Google event failed:", err);
  }
}

export async function sendInvite(meetingId: string) {
  await assertCanEdit(meetingId);
  const m = await db.oneOnOne.findUnique({
    where: { id: meetingId },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true } },
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!m) return { success: false, error: "Not found" };
  if (m.status !== "SCHEDULED") return { success: false, error: "Meeting is not scheduled" };

  const summary = `${TYPE_LABEL[m.type]} — ${m.employee.firstName} ${m.employee.lastName} & ${m.manager.firstName} ${m.manager.lastName}`;
  const description = "1:1 Performance Review";

  // Preferred path: create a real Google Calendar event with Meet so the
  // meeting auto-lands on both calendars and the join link is ready.
  // Prefer the manager's own connected Google Calendar so they're the
  // organizer, not whoever connected the shared integration.
  const managerUserId = await getManagerCalendarUserId(m.managerId);
  if (managerUserId) {
    try {
      const { eventId, meetLink } = await createOneOnOneEventForUser(managerUserId, {
        summary,
        description,
        startTime: m.scheduledAt,
        durationMinutes: DEFAULT_DURATION_MIN,
        employeeEmail: m.employee.email,
        oneOnOneId: m.id,
      });
      await db.oneOnOne.update({
        where: { id: m.id },
        data: { googleEventId: eventId || null, meetingLink: meetLink || m.meetingLink },
      });
      revalidatePath(`/one-on-ones/${m.id}`);
      return { success: true, meetLink };
    } catch (err) {
      console.error("[one-on-one] manager-calendar invite failed, trying shared:", err);
      // fall through to shared / ics
    }
  }
  if (await isCalendarConnected()) {
    try {
      const { eventId, meetLink } = await createOneOnOneEvent({
        summary,
        description,
        startTime: m.scheduledAt,
        durationMinutes: DEFAULT_DURATION_MIN,
        managerEmail: m.manager.email,
        employeeEmail: m.employee.email,
        oneOnOneId: m.id,
      });
      await db.oneOnOne.update({
        where: { id: m.id },
        data: {
          googleEventId: eventId || null,
          meetingLink: meetLink || m.meetingLink,
        },
      });
      revalidatePath(`/one-on-ones/${m.id}`);
      return { success: true, meetLink };
    } catch (err) {
      console.error("[one-on-one] Google Calendar invite failed, falling back to .ics:", err);
      // fall through to ICS path
    }
  }

  // Fallback: Resend email with .ics attachment.
  const ics = buildIcsInvite({
    uid: `${m.id}@calatrava.hr`,
    start: m.scheduledAt,
    durationMinutes: DEFAULT_DURATION_MIN,
    summary,
    description,
    location: m.meetingLink || undefined,
    organizerEmail: m.manager.email,
    organizerName: `${m.manager.firstName} ${m.manager.lastName}`,
    attendees: [
      { email: m.employee.email, name: `${m.employee.firstName} ${m.employee.lastName}` },
      { email: m.manager.email, name: `${m.manager.firstName} ${m.manager.lastName}` },
    ],
  });

  const html = `<p>You have a 1:1 review scheduled.</p>
<p><strong>${summary}</strong><br>
${m.scheduledAt.toLocaleString()}</p>
${m.meetingLink ? `<p>Join: <a href="${m.meetingLink}">${m.meetingLink}</a></p>` : ""}`;

  await Promise.all([
    sendEmailWithAttachments(m.employee.email, summary, html, [
      { filename: "invite.ics", content: ics },
    ]),
    sendEmailWithAttachments(m.manager.email, summary, html, [
      { filename: "invite.ics", content: ics },
    ]),
  ]);

  return { success: true };
}
