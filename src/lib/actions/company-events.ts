"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  attendeeResponses,
  responseCounts,
  type AttendeeResponse,
  type EventResponse,
  type GoogleAttendee,
  type InAppAnswer,
} from "@/lib/event-responses";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!
  );
}

export async function createCompanyEvent(data: {
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO
  durationMinutes: number;
  departmentIds: string[];
  employeeIds: string[];
  trainingGroupIds?: string[];
  includeEveryone?: boolean;
  withMeetLink?: boolean;
}): Promise<{
  success: boolean;
  eventId?: string;
  meetLink?: string | null;
  attendeeCount?: number;
  invitedCount?: number;
  needsCalendarConnection?: boolean;
  error?: string;
}> {
  const session = await requireAuth();
  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    return { success: false, error: "Not authorized to send calendar invites" };
  }

  const title = data.title.trim();
  if (!title) return { success: false, error: "Title is required" };
  const start = new Date(data.startTime);
  if (isNaN(start.getTime())) return { success: false, error: "Invalid start time" };
  const duration = Math.max(5, data.durationMinutes || 30);

  // Resolve attendee list
  const where: Record<string, unknown> = { status: "ACTIVE", email: { not: undefined } };
  const idSet = new Set<string>(data.employeeIds || []);
  if (!data.includeEveryone && data.departmentIds?.length) {
    const deptEmployees = await db.employee.findMany({
      where: { departmentId: { in: data.departmentIds }, status: "ACTIVE" },
      select: { id: true },
    });
    for (const e of deptEmployees) idSet.add(e.id);
  }
  if (!data.includeEveryone && data.trainingGroupIds?.length) {
    const groupMembers = await db.trainingGroupMember.findMany({
      where: {
        groupId: { in: data.trainingGroupIds },
        role: { in: ["TRAINER", "TRAINEE"] },
        employee: { status: "ACTIVE" },
      },
      select: { employeeId: true },
    });
    for (const member of groupMembers) idSet.add(member.employeeId);
  }

  const attendeeSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    preferredName: true,
  } as const;
  let attendees: { id: string; email: string; firstName: string; lastName: string; preferredName: string | null }[] = [];
  if (data.includeEveryone) {
    attendees = await db.employee.findMany({ where, select: attendeeSelect });
  } else {
    if (idSet.size === 0) {
      return { success: false, error: "Pick at least one department or person" };
    }
    attendees = await db.employee.findMany({
      where: { id: { in: Array.from(idSet) }, status: "ACTIVE" },
      select: attendeeSelect,
    });
  }

  if (attendees.length === 0) return { success: false, error: "No active employees matched" };

  const end = new Date(start.getTime() + duration * 60 * 1000);

  const creator = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      googleCalendarSyncEnabled: true,
      googleCalendarAccessToken: true,
      googleCalendarRefreshToken: true,
      employee: { select: { email: true, firstName: true } },
    },
  });

  // Google decides the organizer from the account whose OAuth token creates
  // the event. Never silently use the shared company connection: doing so
  // makes the owner of that connection the organizer instead of the HRIS user.
  if (
    !creator?.googleCalendarSyncEnabled ||
    !creator.googleCalendarAccessToken ||
    !creator.googleCalendarRefreshToken
  ) {
    return {
      success: false,
      needsCalendarConnection: true,
      error:
        "Connect your Google Calendar before creating an event. This ensures you—not the shared company account—are shown as the organizer.",
    };
  }

  // Everyone except the creator is a real attendee on the creator's Google event. Google
  // mails each of them the one invitation they can answer with a click: accepting puts the
  // event on their calendar, and the organizer sees (and is emailed) every answer. The
  // creator's own calendar already holds the event, so they are never invited to it.
  const organizerEmployeeId = session.user.employeeId ?? null;
  const inviteAttendees = attendees.filter((a) => a.id !== organizerEmployeeId);

  const toGoogleAttendee = (a: (typeof attendees)[number]) => ({
    email: a.email,
    displayName: `${a.preferredName?.trim() || a.firstName} ${a.lastName}`,
  });

  try {
    const sync = await import("@/lib/google-calendar-sync");

    const expectedCreatorEmail = (creator.employee?.email || creator.email)
      .trim()
      .toLowerCase();
    try {
      const connectedEmail = await sync.getConnectedGoogleAccountEmail(session.user.id);
      if (connectedEmail !== expectedCreatorEmail) {
        await db.user.update({
          where: { id: session.user.id },
          data: { googleCalendarSyncEnabled: false },
        });
        return {
          success: false,
          needsCalendarConnection: true,
          error: `Your connected Google account (${connectedEmail}) does not match your HRIS email (${expectedCreatorEmail}). Reconnect the matching account before creating the event.`,
        };
      }
    } catch (err) {
      console.error("[createCompanyEvent] Google account verification failed:", err);
      return {
        success: false,
        needsCalendarConnection: true,
        error:
          "We could not verify your connected Google account. Reconnect it, then create the event again.",
      };
    }

    let inserted: { eventId: string; meetLink: string | null };
    try {
      inserted = await sync.createInviteEventForUser(session.user.id, {
        summary: title,
        description: data.description || undefined,
        location: data.location || undefined,
        startTime: start,
        durationMinutes: duration,
        attendees: inviteAttendees.map(toGoogleAttendee),
        withMeetLink: data.withMeetLink,
      });
    } catch (err) {
      console.error("[createCompanyEvent] creator-calendar insert failed:", err);
      return {
        success: false,
        needsCalendarConnection: true,
        error:
          "Your Google Calendar connection needs attention. Reconnect it, then create the event again so you are listed as the organizer.",
      };
    }
    const organizerUserId = session.user.id;
    const meetLink = inserted.meetLink;

    // Store the event in-app too (audience-scoped), so invitees see it on
    // the app calendar and the feed — and nobody else does.
    const authorEmployeeId = session.user.employeeId;
    if (authorEmployeeId) {
      const audienceType = data.includeEveryone ? "all" : "employees";
      const post = await db.feedPost.create({
        data: {
          authorId: authorEmployeeId,
          content: title,
          type: "EVENT",
          eventDate: start,
          eventEndDate: end,
          eventLocation: data.location || null,
          eventDescription: data.description || null,
          eventMeetLink: meetLink,
          eventOrganizerUserId: organizerUserId,
          googleCalendarEventId: inserted.eventId || null,
          audienceType,
          audienceDeptIds: null,
          audienceEmployeeIds:
            audienceType === "employees" ? JSON.stringify(attendees.map((attendee) => attendee.id)) : null,
          notifyViaEmail: false,
          emailTargetType: "none",
        },
      });

      // The organizer is on their own calendar already; everyone else answers the invitation.
      if (attendees.some((a) => a.id === organizerEmployeeId)) {
        await db.eventAttendance.createMany({
          data: [{ feedPostId: post.id, userId: organizerUserId, status: "GOING" as const, googleCalendarEventId: inserted.eventId || null }],
          skipDuplicates: true,
        });
      }

      // In-app notification for invitees (Google already emails the invite)
      const inviteeIds = attendees
        .map((a) => a.id)
        .filter((id) => id !== authorEmployeeId);
      if (inviteeIds.length > 0) {
        await db.notification.createMany({
          data: inviteeIds.map((recipientId) => ({
            recipientId,
            type: "FEED_EVENT",
            message: `You're invited: ${title}`,
            link: "/calendar",
          })),
        });
      }
    }

    // Google places the event directly on an organizer's calendar, but it does
    // not email them an "event created" message. Send that confirmation from
    // HRIS so the creator has an explicit receipt as well.
    const creatorEmail = creator.employee?.email?.trim() || creator.email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail)) {
      try {
        const eventTime = new Intl.DateTimeFormat("en-US", {
          timeZone: process.env.COMPANY_TIME_ZONE || "America/New_York",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(start);
        const calendarUrl = `${process.env.NEXTAUTH_URL || ""}/calendar`;
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(creatorEmail, `Event created: ${title}`, `
          <p>Hi ${escapeHtml(creator.employee?.firstName || "there")},</p>
          <p>Your calendar event has been created successfully.</p>
          <p>
            <strong>${escapeHtml(title)}</strong><br />
            ${escapeHtml(eventTime)}<br />
            ${duration} minutes<br />
            ${attendees.length} attendee${attendees.length === 1 ? "" : "s"}
            ${data.location ? `<br />${escapeHtml(data.location)}` : ""}
          </p>
          ${meetLink ? `<p><a href="${escapeHtml(meetLink)}">Join Google Meet</a></p>` : ""}
          ${calendarUrl ? `<p><a href="${escapeHtml(calendarUrl)}">Open HRIS calendar</a></p>` : ""}
        `);
      } catch (err) {
        // The event already exists at this point. A transient email failure
        // must not report the whole action as failed and encourage duplicates.
        console.error("[createCompanyEvent] creator confirmation email failed:", err);
      }
    }

    revalidatePath("/calendar");
    revalidatePath("/");
    return {
      success: true,
      eventId: inserted.eventId,
      meetLink,
      attendeeCount: attendees.length,
      invitedCount: inviteAttendees.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calendar error";
    console.error("[createCompanyEvent]", err);
    return { success: false, error: msg };
  }
}

async function getManageableCompanyEvent(eventId: string) {
  const session = await requireAuth();
  const post = await db.feedPost.findUnique({
    where: { id: eventId },
    include: {
      attendees: {
        include: { user: { select: { id: true, employeeId: true } } },
      },
    },
  });
  if (!post || post.type !== "EVENT") {
    return { session, post: null, error: "Event not found" } as const;
  }
  const role = session.user.role;
  const canManage =
    post.authorId === session.user.employeeId ||
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "HR";
  if (!canManage) return { session, post: null, error: "Not authorized to manage this event" } as const;
  return { session, post, error: null } as const;
}

export async function updateCompanyEvent(data: {
  eventId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  durationMinutes: number;
}) {
  const access = await getManageableCompanyEvent(data.eventId);
  if (!access.post) return { success: false, error: access.error };
  if (access.post.eventCancelledAt) return { success: false, error: "This event was cancelled" };

  const title = data.title.trim();
  const start = new Date(data.startTime);
  const duration = Math.max(5, Number(data.durationMinutes) || 30);
  if (!title) return { success: false, error: "Title is required" };
  if (Number.isNaN(start.getTime())) return { success: false, error: "Invalid start time" };
  const end = new Date(start.getTime() + duration * 60_000);
  const description = [
    data.description?.trim(),
    access.post.eventMeetLink ? `Join: ${access.post.eventMeetLink}` : null,
  ].filter(Boolean).join("\n\n");

  const sync = await import("@/lib/google-calendar-sync");
  if (access.post.eventOrganizerUserId && access.post.googleCalendarEventId) {
    try {
      await sync.updateInviteEventForUser(
        access.post.eventOrganizerUserId,
        access.post.googleCalendarEventId,
        {
          summary: title,
          description: data.description?.trim() || undefined,
          location: data.location?.trim() || undefined,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
        }
      );
    } catch (err) {
      console.error("[updateCompanyEvent] organizer event update failed:", err);
      return {
        success: false,
        needsCalendarConnection: true,
        error: "The organizer's Google Calendar needs to be reconnected before this event can be edited.",
      };
    }
  }

  await Promise.allSettled(
    access.post.attendees
      .filter(
        (attendance) =>
          attendance.googleCalendarEventId &&
          attendance.user.id !== access.post!.eventOrganizerUserId
      )
      .map((attendance) =>
        sync.updateStandaloneEventForUser(
          attendance.user.id,
          attendance.googleCalendarEventId!,
          {
            summary: title,
            description: description || undefined,
            location: data.location?.trim() || undefined,
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
          }
        )
      )
  );

  await db.feedPost.update({
    where: { id: access.post.id },
    data: {
      content: title,
      eventDescription: data.description?.trim() || null,
      eventLocation: data.location?.trim() || null,
      eventDate: start,
      eventEndDate: end,
    },
  });
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function cancelCompanyEvent(eventId: string) {
  const access = await getManageableCompanyEvent(eventId);
  if (!access.post) return { success: false, error: access.error };
  if (access.post.eventCancelledAt) return { success: true };

  const sync = await import("@/lib/google-calendar-sync");
  const deletions: Promise<void>[] = [];
  if (access.post.eventOrganizerUserId && access.post.googleCalendarEventId) {
    deletions.push(
      sync.deleteEventFromGoogleCalendar(
        access.post.eventOrganizerUserId,
        access.post.googleCalendarEventId
      )
    );
  }
  for (const attendance of access.post.attendees) {
    if (
      attendance.googleCalendarEventId &&
      attendance.user.id !== access.post.eventOrganizerUserId
    ) {
      deletions.push(
        sync.deleteEventFromGoogleCalendar(
          attendance.user.id,
          attendance.googleCalendarEventId
        )
      );
    }
  }
  const results = await Promise.allSettled(deletions);
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount) {
    console.error(`[cancelCompanyEvent] ${failedCount} Google Calendar deletion(s) failed`);
  }

  await db.feedPost.update({
    where: { id: access.post.id },
    data: { eventCancelledAt: new Date() },
  });
  revalidatePath("/calendar");
  revalidatePath("/");
  return {
    success: true,
    warning: failedCount
      ? "The HRIS event was cancelled, but one or more personal calendar copies could not be removed."
      : undefined,
  };
}

/**
 * Who has answered a Calendar-page event, for the organizer and HR. Google's answers come
 * off the organizer's event; answers given in the app fill in the rest. Null when the
 * caller may not see them or the event is not one of ours.
 */
export async function getCompanyEventResponses(eventId: string): Promise<{
  responses: AttendeeResponse[];
  counts: Record<EventResponse, number>;
  fromGoogle: boolean;
} | null> {
  const session = await requireAuth();
  const post = await db.feedPost.findUnique({
    where: { id: eventId, type: "EVENT" },
    select: {
      authorId: true,
      audienceType: true,
      audienceEmployeeIds: true,
      eventOrganizerUserId: true,
      googleCalendarEventId: true,
      attendees: { select: { status: true, user: { select: { email: true, employee: { select: { email: true } } } } } },
    },
  });
  if (!post) return null;
  const role = session.user.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isOrganizer = post.eventOrganizerUserId === session.user.id || post.authorId === session.user.employeeId;
  if (!isAdmin && !isOrganizer) return null;

  let inviteeIds: string[] | null = null;
  if (post.audienceType === "employees") {
    try {
      inviteeIds = JSON.parse(post.audienceEmployeeIds || "[]") as string[];
    } catch {
      inviteeIds = [];
    }
  }
  const organizer = post.eventOrganizerUserId
    ? await db.user.findUnique({ where: { id: post.eventOrganizerUserId }, select: { employeeId: true } })
    : null;
  const people = await db.employee.findMany({
    where: inviteeIds ? { id: { in: inviteeIds } } : { status: "ACTIVE" },
    select: { id: true, email: true, firstName: true, lastName: true, preferredName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const invitees = people
    .filter((p) => p.id !== organizer?.employeeId && p.email)
    .map((p) => ({ email: p.email, name: `${p.preferredName?.trim() || p.firstName} ${p.lastName}` }));

  const inApp: Record<string, InAppAnswer> = {};
  for (const a of post.attendees) {
    for (const email of [a.user.employee?.email, a.user.email]) if (email) inApp[email] = a.status;
  }

  let googleAttendees: GoogleAttendee[] | null = null;
  if (post.eventOrganizerUserId && post.googleCalendarEventId) {
    try {
      const sync = await import("@/lib/google-calendar-sync");
      const event = await sync.getEventForUser(post.eventOrganizerUserId, post.googleCalendarEventId);
      googleAttendees = event.attendees ?? [];
    } catch (err) {
      console.error("[getCompanyEventResponses] Could not read the organizer's event:", err);
    }
  }

  const responses = attendeeResponses({ invitees, googleAttendees, inApp });
  return { responses, counts: responseCounts(responses), fromGoogle: googleAttendees !== null };
}
