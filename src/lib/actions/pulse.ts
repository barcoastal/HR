"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

type Role = "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE" | undefined;

function isAdminRole(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

export async function createPulseSurvey(question: string) {
  const session = await requireAuth();
  if (!isAdminRole(session.user?.role)) {
    throw new Error("Not authorized to create pulse surveys");
  }
  // Close any existing active surveys
  await db.pulseSurvey.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  const survey = await db.pulseSurvey.create({
    data: { question },
  });
  revalidatePath("/settings");
  return survey;
}

export async function closePulseSurvey(surveyId: string) {
  const session = await requireAuth();
  if (!isAdminRole(session.user?.role)) {
    throw new Error("Not authorized to close pulse surveys");
  }
  const survey = await db.pulseSurvey.update({
    where: { id: surveyId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  revalidatePath("/settings");
  return survey;
}

export async function getActivePulseSurvey() {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  const survey = await db.pulseSurvey.findFirst({
    where: { status: "ACTIVE" },
    include: {
      responses: true,
    },
  });

  if (!survey) return null;

  const hasResponded = employeeId
    ? survey.responses.some((r) => r.employeeId === employeeId)
    : false;

  return { survey, hasResponded };
}

export async function submitPulseResponse(surveyId: string, mood: number) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) throw new Error("No employee profile linked to this account");
  // Block duplicate submissions per survey
  const existing = await db.pulseResponse.findFirst({ where: { surveyId, employeeId } });
  if (existing) return existing;
  const response = await db.pulseResponse.create({
    data: { surveyId, employeeId, mood },
  });
  revalidatePath("/settings");
  return response;
}

export async function getPulseSurveyResults(surveyId: string) {
  const session = await requireAuth();
  if (!isAdminRole(session.user?.role)) {
    throw new Error("Not authorized to view pulse survey results");
  }
  const survey = await db.pulseSurvey.findUnique({
    where: { id: surveyId },
    include: {
      responses: true,
      _count: { select: { responses: true } },
    },
  });

  if (!survey) return null;

  const totalResponses = survey.responses.length;
  const avgMood =
    totalResponses > 0
      ? survey.responses.reduce((sum, r) => sum + r.mood, 0) / totalResponses
      : 0;

  const moodDistribution = [1, 2, 3, 4, 5].map(
    (mood) => survey.responses.filter((r) => r.mood === mood).length
  );

  return {
    survey,
    totalResponses,
    avgMood: Math.round(avgMood * 10) / 10,
    moodDistribution,
  };
}

export async function getAllPulseSurveys() {
  const session = await requireAuth();
  if (!isAdminRole(session.user?.role)) {
    throw new Error("Not authorized to view pulse surveys");
  }
  return db.pulseSurvey.findMany({
    include: {
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
