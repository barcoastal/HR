"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { InterviewType } from "@/generated/prisma/client";
import {
  createInterviewEvent,
  cancelInterviewEvent,
  isCalendarConnected as checkCalendarConnected,
} from "@/lib/google-calendar";

export async function scheduleInterview(data: {
  candidateId: string;
  positionId?: string;
  type: InterviewType;
  scheduledAt: string; // ISO datetime
  duration: number;
  notes?: string;
}) {
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
  };

  let googleEventId: string | null = null;
  let googleMeetLink: string | null = null;

  const connected = await checkCalendarConnected();
  if (connected) {
    const positionTitle = candidate.position?.title ?? "Open Position";
    const result = await createInterviewEvent({
      summary: `${typeLabels[data.type]} — ${candidate.firstName} ${candidate.lastName}`,
      description: [
        `Candidate: ${candidate.firstName} ${candidate.lastName}`,
        `Position: ${positionTitle}`,
        data.notes ? `\nNotes: ${data.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      startTime: new Date(data.scheduledAt),
      durationMinutes: data.duration,
      candidateEmail: candidate.email,
    });
    googleEventId = result.eventId;
    googleMeetLink = result.meetLink;
  }

  const interview = await db.interview.create({
    data: {
      candidateId: data.candidateId,
      positionId: data.positionId || candidate.positionId || null,
      type: data.type,
      scheduledAt: new Date(data.scheduledAt),
      duration: data.duration,
      notes: data.notes || null,
      googleEventId,
      googleMeetLink,
    },
  });

  // Send interview confirmation email to candidate
  try {
    const { sendEmail } = await import("@/lib/email");
    const scheduledDate = new Date(data.scheduledAt);
    const dateStr = scheduledDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = scheduledDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const positionTitle = candidate.position?.title ?? "Open Position";
    const meetLinkHtml = googleMeetLink
      ? `<p style="margin-top:16px"><a href="${googleMeetLink}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Join Google Meet</a></p>`
      : "";

    await sendEmail(candidate.email, `Interview Scheduled: ${typeLabels[data.type]}`, `
      <p>Hi ${candidate.firstName},</p>
      <p>Your <strong>${typeLabels[data.type]}</strong> for the <strong>${positionTitle}</strong> position has been scheduled.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0"><strong>Date:</strong> ${dateStr}</p>
        <p style="margin:4px 0 0"><strong>Time:</strong> ${timeStr}</p>
        <p style="margin:4px 0 0"><strong>Duration:</strong> ${data.duration} minutes</p>
      </div>
      ${meetLinkHtml}
      ${data.notes ? `<p style="margin-top:12px;color:#666"><em>Notes: ${data.notes}</em></p>` : ""}
      <p style="margin-top:16px">We look forward to speaking with you!</p>
    `);
  } catch (e) {
    console.error("[interview] Failed to send confirmation email:", e);
  }

  // Send INTERVIEW_SCHEDULED notification via rules engine
  const { sendNotifications } = await import("@/lib/notifications/send");
  sendNotifications({
    action: "INTERVIEW_SCHEDULED",
    candidateId: interview.candidateId,
    message: `Interview scheduled with ${candidate.firstName} ${candidate.lastName}`,
    link: "/cv",
    emailSubject: `Interview Scheduled: ${candidate.firstName} ${candidate.lastName}`,
    emailBody: `<p>An interview has been scheduled with <strong>${candidate.firstName} ${candidate.lastName}</strong>.</p>`,
  }).catch((err) => console.error("[interviews] Notification error:", err));

  revalidatePath("/cv");
  revalidatePath("/calendar");

  return interview;
}

export async function cancelInterview(interviewId: string) {
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
  });
  if (!interview) throw new Error("Interview not found");

  if (interview.googleEventId) {
    try {
      await cancelInterviewEvent(interview.googleEventId);
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
  return db.interview.findMany({
    where: { candidateId },
    include: { position: true },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getUpcomingInterviews() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  // Interview rosters expose candidate PII — gate to recruitment-capable roles.
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    return [];
  }
  return db.interview.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: new Date() },
    },
    include: {
      candidate: true,
      position: true,
    },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function isCalendarConnected(): Promise<boolean> {
  const { isCalendarConnected: check } = await import("@/lib/google-calendar");
  return check();
}
