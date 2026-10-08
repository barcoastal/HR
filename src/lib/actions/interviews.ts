"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { InterviewType } from "@/generated/prisma/client";
import {
  createInterviewEvent,
  cancelInterviewEvent,
  getInterviewEventResponse,
  resendInterviewEventInvite,
  isCalendarConnected as checkCalendarConnected,
} from "@/lib/google-calendar";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { resolveMeetLinkPolicy } from "@/lib/interview-meet-link";
import { candidateRsvp, inviteDelivery, type CandidateRsvp } from "@/lib/interview-invite";
import {
  createInviteEventForUser,
  deleteEventFromGoogleCalendar,
  getEventForUser,
  patchEventAttendeesForUser,
} from "@/lib/google-calendar-sync";

const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: "Pre-screening",
  VIDEO: "Video Interview",
  TECHNICAL: "Technical Interview",
  BEHAVIORAL: "Behavioral Interview",
  PANEL: "Panel Interview",
  FINAL: "Final Interview",
  ONSITE: "Onsite Interview",
};

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
  /**
   * Attach a Google Meet link to the calendar event. Defaults to true for remote
   * interviews. ONSITE interviews only get one when this is explicitly true, so
   * team members who aren't in the office can join; that link is kept out of
   * the candidate's invitation.
   */
  withMeet?: boolean;
}) {
  const session = await requireManagerOrAdmin();
  const candidate = await db.candidate.findUnique({
    where: { id: data.candidateId },
    include: { position: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  const typeLabels = INTERVIEW_TYPE_LABELS;

  const location = data.location?.trim() || null;
  if (data.type === "ONSITE" && !location) {
    throw new Error("Enter a location (address or office / room) for the onsite interview");
  }
  const { createMeetLink: withMeetLink, shareMeetLinkWithCandidate } =
    resolveMeetLinkPolicy(data.type, data.withMeet);

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
        // Google sends the invitation from the interviewer's own calendar — the one invite the
        // candidate can accept, and the interviewer sees the answer on the event.
        sendUpdates: "all",
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
  // INTERVIEW_SCHEDULED template from Settings > Email Templates. Google already carries the
  // invitation when an event exists; the .ics attachment is only the no-calendar fallback.
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
      meetLink: shareMeetLinkWithCandidate ? googleMeetLink : null,
      location,
      notes: data.notes,
      attachCalendarInvite: inviteDelivery(!!googleEventId).attachIcs,
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

/** The candidate's answer on the Google event behind a scheduled interview; null when unknown. */
async function candidateResponseFor(interview: {
  status: string;
  googleEventId: string | null;
  calendarOrganizerUserId: string | null;
  candidate: { email: string };
}): Promise<CandidateRsvp | null> {
  if (interview.status !== "SCHEDULED" || !interview.googleEventId) return null;
  try {
    if (interview.calendarOrganizerUserId) {
      const event = await getEventForUser(interview.calendarOrganizerUserId, interview.googleEventId);
      return candidateRsvp(event.attendees, interview.candidate.email);
    }
    return await getInterviewEventResponse(interview.googleEventId, interview.candidate.email);
  } catch (error) {
    console.error("[interview] Could not read the candidate's calendar response:", error);
    return null;
  }
}

export async function getInterviewsForCandidate(candidateId: string) {
  await requireManagerOrAdmin();
  const interviews = await db.interview.findMany({
    where: { candidateId },
    include: { position: true, interviewer: true, candidate: { select: { email: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  const responses = await Promise.all(interviews.map((i) => candidateResponseFor(i)));
  return interviews.map((interview, idx) => ({ ...interview, candidateResponse: responses[idx] }));
}

/**
 * Send the candidate their invitation again. With a Google event, Google re-sends its own
 * invitation (the one with Accept / Decline); without one, the branded email with the .ics goes
 * out again.
 */
export async function resendInterviewInvite(interviewId: string): Promise<{ via: "google" | "email" }> {
  await requireManagerOrAdmin();
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    include: { candidate: true, position: true, interviewer: true },
  });
  if (!interview) throw new Error("Interview not found");
  if (interview.status !== "SCHEDULED") throw new Error("This interview is no longer scheduled");
  const { candidate } = interview;

  if (interview.googleEventId) {
    if (interview.calendarOrganizerUserId) {
      // Google only mails attendees it has news for: take the candidate off silently, put them back.
      const event = await getEventForUser(interview.calendarOrganizerUserId, interview.googleEventId);
      const wanted = candidate.email.trim().toLowerCase();
      const others = (event.attendees ?? [])
        .filter((a) => (a.email ?? "").trim().toLowerCase() !== wanted && a.email)
        .map((a) => ({ email: a.email as string, displayName: a.displayName }));
      await patchEventAttendeesForUser(interview.calendarOrganizerUserId, interview.googleEventId, others, "none");
      await patchEventAttendeesForUser(
        interview.calendarOrganizerUserId,
        interview.googleEventId,
        [...others, { email: candidate.email, displayName: `${candidate.firstName} ${candidate.lastName}` }],
        "all",
      );
    } else {
      await resendInterviewEventInvite(interview.googleEventId, candidate.email);
    }
    return { via: "google" };
  }

  const interviewer = interview.interviewer;
  if (!interviewer) throw new Error("This interview has no interviewer — cancel it and schedule again");
  const { shareMeetLinkWithCandidate } = resolveMeetLinkPolicy(interview.type, !!interview.googleMeetLink);
  const { sendInterviewScheduledEmail } = await import("@/lib/email");
  const sent = await sendInterviewScheduledEmail({
    to: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    interviewId: interview.id,
    interviewType: INTERVIEW_TYPE_LABELS[interview.type],
    positionTitle: interview.position?.title ?? "Open Position",
    scheduledAt: interview.scheduledAt,
    duration: interview.duration,
    interviewerName: `${interviewer.preferredName || interviewer.firstName} ${interviewer.lastName}`,
    interviewerEmail: interviewer.email,
    interviewerEmployeeId: interviewer.id,
    meetLink: shareMeetLinkWithCandidate ? interview.googleMeetLink : null,
    location: interview.location,
    notes: interview.notes ?? undefined,
    attachCalendarInvite: true,
  });
  if (!sent.success) throw new Error(sent.error || "The invitation email could not be sent");
  return { via: "email" };
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
