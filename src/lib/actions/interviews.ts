"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { InterviewType } from "@/generated/prisma/client";
import {
  createInterviewEvent,
  cancelInterviewEvent,
  isCalendarConnected as checkCalendarConnected,
} from "@/lib/google-calendar";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import {
  createInviteEventForUser,
  deleteEventFromGoogleCalendar,
} from "@/lib/google-calendar-sync";

export async function scheduleInterview(data: {
  candidateId: string;
  positionId?: string;
  type: InterviewType;
  scheduledAt: string; // ISO datetime
  duration: number;
  notes?: string;
  interviewerId?: string;
  /** Required for ONSITE interviews: address or office / room. */
  location?: string;
  /** Attach a Google Meet link to the calendar invite (ignored for ONSITE). Defaults to true. */
  withMeet?: boolean;
}) {
  const session = await requireManagerOrAdmin();
  const candidate = await db.candidate.findUnique({
    where: { id: data.candidateId },
    include: { position: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  const typeLabels: Record<InterviewType, string> = {
    PHONE_SCREEN: "Phone Screen",
    VIDEO: "Video Interview",
    TECHNICAL: "Technical Interview",
    BEHAVIORAL: "Behavioral Interview",
    PANEL: "Panel Interview",
    FINAL: "Final Interview",
    ONSITE: "Onsite Interview",
  };

  const location = data.location?.trim() || null;
  if (data.type === "ONSITE" && !location) {
    throw new Error("Enter a location (address or office / room) for the onsite interview");
  }
  // Onsite interviews never get a Meet link; every other type gets one unless
  // the scheduler explicitly opted out.
  const withMeetLink = data.type !== "ONSITE" && data.withMeet !== false;

  let googleEventId: string | null = null;
  let googleMeetLink: string | null = null;
  let calendarOrganizerUserId: string | null = null;
  const interviewerId = data.interviewerId
    || candidate.recruiterId
    || session.user?.employeeId;
  if (!interviewerId) {
    throw new Error("Select an interviewer before scheduling this interview");
  }
  const interviewer = await db.employee.findUnique({
    where: { id: interviewerId },
    include: { user: true },
  });
  if (!interviewer) throw new Error("The selected interviewer was not found");

  const positionTitle = candidate.position?.title ?? "Open Position";
  const summary = `${typeLabels[data.type]}: ${candidate.firstName} ${candidate.lastName}`;
  const description = [
    `Candidate: ${candidate.firstName} ${candidate.lastName}`,
    `Position: ${positionTitle}`,
    `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
    location ? `Location: ${location}` : "",
    data.notes ? `Notes: ${data.notes}` : "",
  ].filter(Boolean).join("\n");

  if (interviewer.user?.googleCalendarSyncEnabled) {
    try {
      const result = await createInviteEventForUser(interviewer.user.id, {
        summary,
        description,
        location: location ?? undefined,
        startTime: new Date(data.scheduledAt),
        durationMinutes: data.duration,
        attendees: [{
          email: candidate.email,
          displayName: `${candidate.firstName} ${candidate.lastName}`,
        }],
        withMeetLink,
        sendUpdates: "none",
      });
      googleEventId = result.eventId;
      googleMeetLink = result.meetLink;
      calendarOrganizerUserId = interviewer.user.id;
    } catch (error) {
      console.error("[interview] Interviewer calendar creation failed, using shared calendar:", error);
    }
  }

  if (!googleEventId && await checkCalendarConnected()) {
    const result = await createInterviewEvent({
      summary,
      description,
      location: location ?? undefined,
      startTime: new Date(data.scheduledAt),
      durationMinutes: data.duration,
      candidateEmail: candidate.email,
      withMeetLink,
    });
    googleEventId = result.eventId;
    googleMeetLink = result.meetLink;
  }

  const interview = await db.interview.create({
    data: {
      candidateId: data.candidateId,
      positionId: data.positionId || candidate.positionId || null,
      interviewerId: interviewer.id,
      calendarOrganizerUserId,
      type: data.type,
      scheduledAt: new Date(data.scheduledAt),
      duration: data.duration,
      notes: data.notes || null,
      location,
      googleEventId,
      googleMeetLink,
    },
  });

  // Send interview confirmation email to candidate — uses the editable
  // INTERVIEW_SCHEDULED template from Settings > Email Templates.
  try {
    const { sendInterviewScheduledEmail } = await import("@/lib/email");
    await sendInterviewScheduledEmail({
      to: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      interviewId: interview.id,
      interviewType: typeLabels[data.type],
      positionTitle,
      scheduledAt: new Date(data.scheduledAt),
      duration: data.duration,
      interviewerName: `${interviewer.preferredName || interviewer.firstName} ${interviewer.lastName}`,
      interviewerEmail: interviewer.email,
      interviewerEmployeeId: interviewer.id,
      meetLink: googleMeetLink,
      location,
      notes: data.notes,
    });
  } catch (e) {
    console.error("[interview] Failed to send confirmation email:", e);
  }

  // Keep the internal notification, but never ask the rules engine to send
  // another interview email. The candidate receives the single tracked invite above.
  const { sendNotifications } = await import("@/lib/notifications/send");
  sendNotifications({
    action: "INTERVIEW_SCHEDULED",
    candidateId: interview.candidateId,
    message: `Interview scheduled with ${candidate.firstName} ${candidate.lastName}`,
    link: "/cv",
  }).catch((err) => console.error("[interviews] Notification error:", err));

  revalidatePath("/cv");
  revalidatePath("/calendar");

  return interview;
}

export async function cancelInterview(interviewId: string) {
  await requireManagerOrAdmin();
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
  });
  if (!interview) throw new Error("Interview not found");

  if (interview.googleEventId) {
    try {
      if (interview.calendarOrganizerUserId) {
        await deleteEventFromGoogleCalendar(interview.calendarOrganizerUserId, interview.googleEventId);
      } else {
        await cancelInterviewEvent(interview.googleEventId);
      }
    } catch {
      // Event may already be deleted on Google side — proceed with DB update
    }
  }

  await db.interview.update({
    where: { id: interviewId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/cv");
  revalidatePath("/calendar");
}

export async function getInterviewsForCandidate(candidateId: string) {
  await requireManagerOrAdmin();
  return db.interview.findMany({
    where: { candidateId },
    include: { position: true, interviewer: true },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getUpcomingInterviews() {
  await requireManagerOrAdmin();
  return db.interview.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: new Date() },
    },
    include: {
      candidate: true,
      position: true,
      interviewer: true,
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function isCalendarConnected(): Promise<boolean> {
  await requireManagerOrAdmin();
  const { isCalendarConnected: check } = await import("@/lib/google-calendar");
  return check();
}
