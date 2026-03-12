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
