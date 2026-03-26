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
  // Don't return pdfData in list queries (too large)
  // Use raw query to check if pdfData exists without loading it
  const docs = await db.stageDocument.findMany({
    select: { id: true, stage: true, name: true, placeholders: true, requiresSignature: true, order: true, createdAt: true, updatedAt: true },
    orderBy: [{ stage: "asc" }, { order: "asc" }],
  });
  // Check which docs have PDF data without loading the blobs
  const ids = docs.map((d) => d.id);
  const withPdf = ids.length > 0
    ? await db.stageDocument.findMany({
        where: { id: { in: ids }, pdfData: { not: null } },
        select: { id: true },
      })
    : [];
  const pdfSet = new Set(withPdf.map((d) => d.id));
  return docs.map((d) => ({
    id: d.id,
    stage: d.stage,
    name: d.name,
    placeholders: d.placeholders,
    requiresSignature: d.requiresSignature,
    order: d.order,
    hasPdf: pdfSet.has(d.id),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function getStageDocumentWithPdf(id: string) {
  return db.stageDocument.findUnique({ where: { id } });
}

export async function createStageDocument(data: {
  stage: string;
  name: string;
  pdfData: string; // base64
  placeholders: string; // JSON
  requiresSignature?: boolean;
}) {
  if (!DOCUMENT_STAGES.includes(data.stage)) {
    throw new Error("Invalid stage for documents");
  }
  const count = await db.stageDocument.count({ where: { stage: data.stage } });
  const doc = await db.stageDocument.create({
    data: {
      stage: data.stage,
      name: data.name,
      pdfData: data.pdfData,
      placeholders: data.placeholders,
      requiresSignature: data.requiresSignature ?? false,
      order: count,
    },
  });
  revalidatePath("/settings");
  return { id: doc.id, stage: doc.stage, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function updateStageDocument(
  id: string,
  data: { name?: string; placeholders?: string; pdfData?: string; requiresSignature?: boolean }
) {
  const doc = await db.stageDocument.update({ where: { id }, data });
  revalidatePath("/settings");
  return { id: doc.id, stage: doc.stage, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function deleteStageDocument(id: string) {
  await db.stageDocument.delete({ where: { id } });
  revalidatePath("/settings");
}
