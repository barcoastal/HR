"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPulseSurvey(question: string) {
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
  const survey = await db.pulseSurvey.update({
    where: { id: surveyId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  revalidatePath("/settings");
  return survey;
}

export async function getActivePulseSurvey(employeeId?: string) {
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

export async function submitPulseResponse(
  surveyId: string,
  employeeId: string,
  mood: number
) {
  const response = await db.pulseResponse.create({
    data: { surveyId, employeeId, mood },
  });
  revalidatePath("/settings");
  return response;
}

export async function getPulseSurveyResults(surveyId: string) {
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
  return db.pulseSurvey.findMany({
    include: {
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
