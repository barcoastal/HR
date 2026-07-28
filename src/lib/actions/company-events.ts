"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { isSandboxMode, logSandbox, sandboxEventId, sandboxMeetLink } from "@/lib/sandbox";

export async function createCompanyEvent(data: {
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO
  durationMinutes: number;
  departmentIds: string[];
  employeeIds: string[];
  includeEveryone?: boolean;
  withMeetLink?: boolean;
}): Promise<{ success: boolean; eventId?: string; meetLink?: string | null; attendeeCount?: number; error?: string }> {
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

  let attendees: { id: string; email: string; firstName: string; lastName: string }[] = [];
  if (data.includeEveryone) {
    attendees = await db.employee.findMany({
      where,
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  } else {
    if (idSet.size === 0) {
      return { success: false, error: "Pick at least one department or person" };
    }
    attendees = await db.employee.findMany({
      where: { id: { in: Array.from(idSet) }, status: "ACTIVE" },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  if (attendees.length === 0) return { success: false, error: "No active employees matched" };

  const end = new Date(start.getTime() + duration * 60 * 1000);

  if (await isSandboxMode()) {
    const eventId = sandboxEventId("company");
    const meetLink = data.withMeetLink ? sandboxMeetLink("company") : null;
    logSandbox("calendar", `Would create company event "${title}" for ${attendees.length} attendee(s)`, {
      eventId,
      meetLink,
      start: start.toISOString(),
      emails: attendees.map((a) => a.email),
    });
    revalidatePath("/calendar");
    return { success: true, eventId, meetLink, attendeeCount: attendees.length };
  }

  try {
    const { getCalendarClient } = await import("@/lib/google-calendar");
    const calendar = await getCalendarClient();
    const res = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      conferenceDataVersion: data.withMeetLink ? 1 : undefined,
      requestBody: {
        summary: title,
        description: data.description || undefined,
        location: data.location || undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: attendees.map((a) => ({ email: a.email, displayName: `${a.firstName} ${a.lastName}` })),
        conferenceData: data.withMeetLink
          ? { createRequest: { requestId: `company-event-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } }
          : undefined,
      },
    });

    // Store the event in-app too (audience-scoped), so invitees see it on
    // the app calendar and the feed — and nobody else does.
    const authorEmployeeId = session.user.employeeId;
    if (authorEmployeeId) {
      const audienceType = data.includeEveryone
        ? "all"
        : data.departmentIds?.length
        ? "departments"
        : "employees";
      await db.feedPost.create({
        data: {
          authorId: authorEmployeeId,
          content: title,
          type: "EVENT",
          eventDate: start,
          eventEndDate: end,
          eventLocation: data.location || null,
          audienceType,
          audienceDeptIds: audienceType === "departments" ? JSON.stringify(data.departmentIds) : null,
          audienceEmployeeIds: audienceType === "employees" ? JSON.stringify(data.employeeIds) : null,
          notifyViaEmail: false,
          emailTargetType: "none",
        },
      });

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

    revalidatePath("/calendar");
    revalidatePath("/");
    return {
      success: true,
      eventId: res.data.id ?? "",
      meetLink: res.data.hangoutLink ?? null,
      attendeeCount: attendees.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Calendar error";
    console.error("[createCompanyEvent]", err);
    return { success: false, error: msg };
  }
}
