"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DOCUMENT_STAGES = ["PRE_ONBOARDING", "ONBOARDING", "OFFBOARDING"];

export async function getStageDocuments(stage: string) {
  return db.stageDocument.findMany({
    where: { stage },
    orderBy: { order: "asc" },
  });
}

export async function getAllStageDocuments() {
  return db.stageDocument.findMany({
    orderBy: [{ stage: "asc" }, { order: "asc" }],
  });
}

export async function createStageDocument(data: {
  stage: string;
  name: string;
  content: string;
}) {
  if (!DOCUMENT_STAGES.includes(data.stage)) {
    throw new Error("Invalid stage for documents");
  }
  const count = await db.stageDocument.count({ where: { stage: data.stage } });
  const doc = await db.stageDocument.create({
    data: { ...data, order: count },
  });
  revalidatePath("/settings");
  return doc;
}

export async function updateStageDocument(
  id: string,
  data: { name?: string; content?: string; order?: number }
) {
  const doc = await db.stageDocument.update({ where: { id }, data });
  revalidatePath("/settings");
  return doc;
}

export async function deleteStageDocument(id: string) {
  await db.stageDocument.delete({ where: { id } });
  revalidatePath("/settings");
}
