"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { displayName } from "@/lib/utils";
import { COMPANY_TIME_ZONE, zonedParts } from "@/lib/time-zone";
import { revalidatePath } from "next/cache";

type TrainingMemberRole = "TRAINER" | "TRAINEE" | "VIEWER";

type TrainingClassInput = {
  title: string;
  agenda?: string;
  location?: string;
  groupId?: string | null;
  trainerId: string;
  traineeIds: string[];
  viewerIds?: string[];
  visibleToManagers?: boolean;
  sessionStarts: string[];
  durationMinutes: number;
  startTime: string;
  endTime: string;
  timeZone?: string;
  withMeetLink?: boolean;
};

function canManageCalendar(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";
}

function isAdmin(role?: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

function parseIds(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function validateSchedule(sessionStarts: string[], durationMinutes: number) {
  const duration = Math.max(15, Math.min(720, Number(durationMinutes) || 60));
  const starts = [...new Set(sessionStarts)]
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (starts.length === 0) throw new Error("Add at least one training session");
  if (starts.length > 60) throw new Error("A training class can contain up to 60 sessions");
  return { starts, duration };
}

async function getOrganizer(trainerId: string) {
  const trainer = await db.employee.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      status: true,
      user: {
        select: {
          id: true,
          email: true,
          googleCalendarSyncEnabled: true,
          googleCalendarAccessToken: true,
          googleCalendarRefreshToken: true,
        },
      },
    },
  });
  if (!trainer || trainer.status !== "ACTIVE") throw new Error("Select an active trainer");
  if (
    !trainer.user?.googleCalendarSyncEnabled ||
    !trainer.user.googleCalendarAccessToken ||
    !trainer.user.googleCalendarRefreshToken
  ) {
    throw new Error(`${displayName(trainer)} must connect Google Calendar before becoming the class organizer`);
  }
  const sync = await import("@/lib/google-calendar-sync");
  await sync.assertConnectedGoogleAccount(trainer.user.id, trainer.email || trainer.user.email);
  return { trainer, userId: trainer.user.id };
}

async function getActiveEmployees(ids: string[]) {
  if (ids.length === 0) return [];
  return db.employee.findMany({
    where: { id: { in: [...new Set(ids)] }, status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  });
}

async function syncTrainingSessions(trainingClassId: string) {
  const trainingClass = await db.trainingClass.findUnique({
    where: { id: trainingClassId },
    include: {
      organizer: {
        select: { id: true, email: true, firstName: true, lastName: true, preferredName: true },
      },
      sessions: { where: { status: "SCHEDULED" }, orderBy: { startAt: "asc" } },
    },
  });
  if (!trainingClass) throw new Error("Training class not found");

  const employees = await getActiveEmployees(parseIds(trainingClass.attendeeEmployeeIds));
  const attendees = employees
    .filter((employee) => employee.id !== trainingClass.organizerId)
    .map((employee) => ({ email: employee.email, displayName: displayName(employee) }));
  const sync = await import("@/lib/google-calendar-sync");
  let failedCount = 0;

  for (const session of trainingClass.sessions) {
    try {
      const durationMinutes = Math.max(
        15,
        Math.round((session.endAt.getTime() - session.startAt.getTime()) / 60_000)
      );
      const created = await sync.createInviteEventForUser(trainingClass.organizerUserId, {
        summary: trainingClass.title,
        description: trainingClass.agenda || "Training session",
        location: trainingClass.location || undefined,
        startTime: session.startAt,
        durationMinutes,
        attendees,
        withMeetLink: trainingClass.withMeetLink,
      });
      await db.trainingSession.update({
        where: { id: session.id },
        data: {
          googleCalendarEventId: created.eventId || null,
          meetLink: created.meetLink,
        },
      });
    } catch (err) {
      failedCount += 1;
      console.error(`[training-calendar] session ${session.id} Google sync failed:`, err);
    }
  }
  return { failedCount, sessionCount: trainingClass.sessions.length, organizer: trainingClass.organizer };
}

async function removeGoogleTrainingSessions(
  organizerUserId: string,
  sessions: { googleCalendarEventId: string | null }[]
) {
  const sync = await import("@/lib/google-calendar-sync");
  await Promise.allSettled(
    sessions
      .filter((session) => session.googleCalendarEventId)
      .map((session) =>
        sync.deleteEventFromGoogleCalendar(organizerUserId, session.googleCalendarEventId!)
      )
  );
}

export async function saveTrainingGroup(input: {
  id?: string;
  name: string;
  description?: string;
  members: { employeeId: string; role: TrainingMemberRole }[];
}) {
  const session = await requireAuth();
  if (!canManageCalendar(session.user.role) || !session.user.employeeId) {
    return { success: false, error: "Not authorized to manage training groups" };
  }
  const name = input.name.trim();
  if (!name) return { success: false, error: "Group name is required" };

  const validRoles = new Set<TrainingMemberRole>(["TRAINER", "TRAINEE", "VIEWER"]);
  const deduped = new Map<string, { employeeId: string; role: TrainingMemberRole }>();
  for (const member of input.members) {
    if (!member.employeeId || !validRoles.has(member.role)) continue;
    deduped.set(`${member.employeeId}:${member.role}`, member);
  }
  if (![...deduped.values()].some((member) => member.role === "TRAINER")) {
    return { success: false, error: "Add at least one trainer" };
  }
  if (![...deduped.values()].some((member) => member.role === "TRAINEE")) {
    return { success: false, error: "Add at least one trainee" };
  }

  if (input.id) {
    const existing = await db.trainingGroup.findUnique({ where: { id: input.id } });
    if (!existing) return { success: false, error: "Training group not found" };
    if (existing.createdById !== session.user.employeeId && !isAdmin(session.user.role)) {
      return { success: false, error: "You can only edit groups you created" };
    }
    await db.$transaction([
      db.trainingGroup.update({
        where: { id: input.id },
        data: { name, description: input.description?.trim() || null },
      }),
      db.trainingGroupMember.deleteMany({ where: { groupId: input.id } }),
      db.trainingGroupMember.createMany({
        data: [...deduped.values()].map((member) => ({ groupId: input.id!, ...member })),
      }),
    ]);
  } else {
    await db.trainingGroup.create({
      data: {
        name,
        description: input.description?.trim() || null,
        createdById: session.user.employeeId,
        members: { create: [...deduped.values()] },
      },
    });
  }
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteTrainingGroup(groupId: string) {
  const session = await requireAuth();
  const group = await db.trainingGroup.findUnique({ where: { id: groupId } });
  if (!group) return { success: true };
  if (group.createdById !== session.user.employeeId && !isAdmin(session.user.role)) {
    return { success: false, error: "You can only delete groups you created" };
  }
  await db.trainingGroup.delete({ where: { id: groupId } });
  revalidatePath("/calendar");
  return { success: true };
}

export async function createTrainingClass(input: TrainingClassInput) {
  const session = await requireAuth();
  if (!canManageCalendar(session.user.role) || !session.user.employeeId) {
    return { success: false, error: "Not authorized to schedule training" };
  }

  try {
    const title = input.title.trim();
    if (!title) throw new Error("Class title is required");
    const { starts, duration } = validateSchedule(input.sessionStarts, input.durationMinutes);
    const { trainer, userId } = await getOrganizer(input.trainerId);
    const attendeeIds = [...new Set([input.trainerId, ...input.traineeIds])];
    const attendees = await getActiveEmployees(attendeeIds);
    if (attendees.length < 2) throw new Error("Add at least one active trainee");
    const viewerIds = [...new Set(input.viewerIds || [])];
    const finalEnd = new Date(starts.at(-1)!.getTime() + duration * 60_000);
    const weekdays = [...new Set(starts.map((start) => zonedParts(start).weekday))];

    const trainingClass = await db.trainingClass.create({
      data: {
        title,
        agenda: input.agenda?.trim() || null,
        location: input.location?.trim() || null,
        organizerId: trainer.id,
        createdById: session.user.employeeId,
        organizerUserId: userId,
        groupId: input.groupId || null,
        attendeeEmployeeIds: JSON.stringify(attendees.map((employee) => employee.id)),
        viewerEmployeeIds: viewerIds.length ? JSON.stringify(viewerIds) : null,
        visibleToManagers: input.visibleToManagers !== false,
        rangeStart: starts[0],
        rangeEnd: finalEnd,
        startTime: input.startTime,
        endTime: input.endTime,
        weekdays: JSON.stringify(weekdays),
        timeZone: input.timeZone || COMPANY_TIME_ZONE,
        withMeetLink: input.withMeetLink !== false,
        sessions: {
          create: starts.map((start) => ({
            startAt: start,
            endAt: new Date(start.getTime() + duration * 60_000),
          })),
        },
      },
    });

    const syncResult = await syncTrainingSessions(trainingClass.id);
    const recipients = [...new Set([...attendees.map((employee) => employee.id), ...viewerIds])]
      .filter((employeeId) => employeeId !== session.user.employeeId);
    if (recipients.length) {
      await db.notification.createMany({
        data: recipients.map((recipientId) => ({
          recipientId,
          type: "TRAINING_CLASS",
          message: `Training scheduled: ${title}`,
          link: "/calendar",
        })),
      });
    }

    const { sendEmail } = await import("@/lib/email");
    await sendEmail(
      trainer.email,
      `Training class created: ${title}`,
      `<p>Hi ${trainer.preferredName?.trim() || trainer.firstName},</p>
       <p>You are the organizer for <strong>${title}</strong>.</p>
       <p>${starts.length} session${starts.length === 1 ? "" : "s"} were scheduled. Open CALATRAVA for the full schedule.</p>`
    );

    revalidatePath("/calendar");
    return {
      success: true,
      trainingClassId: trainingClass.id,
      sessionCount: syncResult.sessionCount,
      warning: syncResult.failedCount
        ? `${syncResult.failedCount} session${syncResult.failedCount === 1 ? "" : "s"} could not be added to Google Calendar.`
        : undefined,
    };
  } catch (err) {
    console.error("[createTrainingClass]", err);
    return {
      success: false,
      needsCalendarConnection: err instanceof Error && /connect|Google account/i.test(err.message),
      error: err instanceof Error ? err.message : "Could not create the training class",
    };
  }
}

async function getManageableTrainingClass(trainingClassId: string) {
  const session = await requireAuth();
  const trainingClass = await db.trainingClass.findUnique({
    where: { id: trainingClassId },
    include: { sessions: true },
  });
  if (!trainingClass) return { session, trainingClass: null, error: "Training class not found" } as const;
  const allowed =
    isAdmin(session.user.role) ||
    trainingClass.createdById === session.user.employeeId ||
    trainingClass.organizerId === session.user.employeeId;
  if (!allowed) return { session, trainingClass: null, error: "Not authorized to manage this class" } as const;
  return { session, trainingClass, error: null } as const;
}

export async function updateTrainingClass(
  input: TrainingClassInput & { trainingClassId: string }
) {
  const access = await getManageableTrainingClass(input.trainingClassId);
  if (!access.trainingClass) return { success: false, error: access.error };

  try {
    const title = input.title.trim();
    if (!title) throw new Error("Class title is required");
    const { starts, duration } = validateSchedule(input.sessionStarts, input.durationMinutes);
    const { trainer, userId } = await getOrganizer(input.trainerId);
    const attendees = await getActiveEmployees([...new Set([input.trainerId, ...input.traineeIds])]);
    if (attendees.length < 2) throw new Error("Add at least one active trainee");
    const viewerIds = [...new Set(input.viewerIds || [])];

    await removeGoogleTrainingSessions(
      access.trainingClass.organizerUserId,
      access.trainingClass.sessions
    );
    await db.$transaction([
      db.trainingSession.deleteMany({ where: { trainingClassId: access.trainingClass.id } }),
      db.trainingClass.update({
        where: { id: access.trainingClass.id },
        data: {
          title,
          agenda: input.agenda?.trim() || null,
          location: input.location?.trim() || null,
          organizerId: trainer.id,
          organizerUserId: userId,
          groupId: input.groupId || null,
          attendeeEmployeeIds: JSON.stringify(attendees.map((employee) => employee.id)),
          viewerEmployeeIds: viewerIds.length ? JSON.stringify(viewerIds) : null,
          visibleToManagers: input.visibleToManagers !== false,
          rangeStart: starts[0],
          rangeEnd: new Date(starts.at(-1)!.getTime() + duration * 60_000),
          startTime: input.startTime,
          endTime: input.endTime,
          weekdays: JSON.stringify([...new Set(starts.map((start) => zonedParts(start).weekday))]),
          timeZone: input.timeZone || COMPANY_TIME_ZONE,
          withMeetLink: input.withMeetLink !== false,
          sessions: {
            create: starts.map((start) => ({
              startAt: start,
              endAt: new Date(start.getTime() + duration * 60_000),
            })),
          },
        },
      }),
    ]);
    const result = await syncTrainingSessions(access.trainingClass.id);
    revalidatePath("/calendar");
    return {
      success: true,
      warning: result.failedCount
        ? `${result.failedCount} Google Calendar session${result.failedCount === 1 ? "" : "s"} could not be updated.`
        : undefined,
    };
  } catch (err) {
    console.error("[updateTrainingClass]", err);
    return { success: false, error: err instanceof Error ? err.message : "Could not update the class" };
  }
}

export async function cancelTrainingClass(trainingClassId: string) {
  const access = await getManageableTrainingClass(trainingClassId);
  if (!access.trainingClass) return { success: false, error: access.error };
  if (access.trainingClass.status === "CANCELLED") return { success: true };

  await removeGoogleTrainingSessions(
    access.trainingClass.organizerUserId,
    access.trainingClass.sessions
  );
  await db.$transaction([
    db.trainingClass.update({ where: { id: trainingClassId }, data: { status: "CANCELLED" } }),
    db.trainingSession.updateMany({
      where: { trainingClassId },
      data: { status: "CANCELLED" },
    }),
  ]);
  revalidatePath("/calendar");
  return { success: true };
}

export async function getVisibleTrainingSessions(from: Date, to: Date) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  const role = session.user.role;
  const classes = await db.trainingClass.findMany({
    where: {
      status: "ACTIVE",
      rangeStart: { lte: to },
      rangeEnd: { gte: from },
    },
    include: {
      organizer: {
        select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
      },
      group: { select: { name: true } },
      sessions: {
        where: { status: "SCHEDULED", startAt: { lte: to }, endAt: { gte: from } },
        orderBy: { startAt: "asc" },
      },
    },
  });

  const visible = classes.filter((trainingClass) => {
    if (isAdmin(role)) return true;
    if (!employeeId) return false;
    if (trainingClass.organizerId === employeeId || trainingClass.createdById === employeeId) return true;
    if (parseIds(trainingClass.attendeeEmployeeIds).includes(employeeId)) return true;
    if (parseIds(trainingClass.viewerEmployeeIds).includes(employeeId)) return true;
    return role === "MANAGER" && trainingClass.visibleToManagers;
  });

  const employeeIds = [...new Set(visible.flatMap((item) => parseIds(item.attendeeEmployeeIds)))];
  const people = await getActiveEmployees(employeeIds);
  const nameById = new Map(people.map((person) => [person.id, displayName(person)]));

  return visible.flatMap((trainingClass) => {
    const attendeeNames = parseIds(trainingClass.attendeeEmployeeIds)
      .map((id) => nameById.get(id))
      .filter((name): name is string => !!name);
    const canManage =
      isAdmin(role) ||
      trainingClass.createdById === employeeId ||
      trainingClass.organizerId === employeeId;
    return trainingClass.sessions.map((trainingSession) => ({
      id: trainingSession.id,
      trainingClassId: trainingClass.id,
      title: trainingClass.title,
      agenda: trainingClass.agenda,
      location: trainingClass.location,
      startAt: trainingSession.startAt,
      endAt: trainingSession.endAt,
      meetLink: trainingSession.meetLink,
      organizer: displayName(trainingClass.organizer),
      attendees: attendeeNames,
      groupName: trainingClass.group?.name || null,
      canManage,
    }));
  });
}

export async function getTrainingWorkspace() {
  const session = await requireAuth();
  if (!canManageCalendar(session.user.role)) return { groups: [], classes: [] };
  const groups = await db.trainingGroup.findMany({
    include: {
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  const classes = await db.trainingClass.findMany({
    where: { rangeEnd: { gte: new Date() } },
    include: {
      organizer: {
        select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
      },
      sessions: { orderBy: { startAt: "asc" } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { rangeStart: "asc" },
  });
  return { groups, classes };
}
