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
    select: { id: true, stage: true, name: true, placeholders: true, requiresSignature: true, requiresFill: true, requiresCountersignature: true, countersignerId: true, order: true, createdAt: true, updatedAt: true },
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
    requiresFill: d.requiresFill,
    requiresCountersignature: d.requiresCountersignature,
    countersignerId: d.countersignerId,
    order: d.order,
    hasPdf: pdfSet.has(d.id),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function getEligibleCountersigners() {
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, employeeId: { not: null } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
  });
  return users
    .map((u) => u.employee)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
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
  requiresFill?: boolean;
  requiresCountersignature?: boolean;
  countersignerId?: string | null;
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
      requiresFill: data.requiresFill ?? false,
      requiresCountersignature: data.requiresCountersignature ?? false,
      countersignerId: data.countersignerId ?? null,
      order: count,
    },
  });
  revalidatePath("/settings");
  return { id: doc.id, stage: doc.stage, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function updateStageDocument(
  id: string,
  data: { name?: string; placeholders?: string; pdfData?: string; requiresSignature?: boolean; requiresFill?: boolean; requiresCountersignature?: boolean; countersignerId?: string | null }
) {
  const doc = await db.stageDocument.update({ where: { id }, data });
  revalidatePath("/settings");
  return { id: doc.id, stage: doc.stage, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function deleteStageDocument(id: string) {
  await db.stageDocument.delete({ where: { id } });
  revalidatePath("/settings");
}
