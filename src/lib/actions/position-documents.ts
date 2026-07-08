"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPositionDocuments(positionId: string) {
  return db.positionDocument.findMany({
    where: { positionId },
    orderBy: { order: "asc" },
  });
}

export async function getAllPositionDocuments() {
  // Don't return pdfData in list queries (too large)
  const docs = await db.positionDocument.findMany({
    select: { id: true, positionId: true, name: true, placeholders: true, requiresSignature: true, requiresFill: true, requiresCountersignature: true, countersignerId: true, order: true, createdAt: true, updatedAt: true },
    orderBy: [{ positionId: "asc" }, { order: "asc" }],
  });
  const ids = docs.map((d) => d.id);
  const withPdf = ids.length > 0
    ? await db.positionDocument.findMany({
        where: { id: { in: ids }, pdfData: { not: null } },
        select: { id: true },
      })
    : [];
  const pdfSet = new Set(withPdf.map((d) => d.id));
  return docs.map((d) => ({
    id: d.id,
    positionId: d.positionId,
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

export async function createPositionDocument(data: {
  positionId: string;
  name: string;
  pdfData: string; // base64
  placeholders: string; // JSON
  requiresSignature?: boolean;
  requiresFill?: boolean;
  requiresCountersignature?: boolean;
  countersignerId?: string | null;
}) {
  const position = await db.position.findUnique({ where: { id: data.positionId }, select: { id: true } });
  if (!position) throw new Error("Position not found");
  const count = await db.positionDocument.count({ where: { positionId: data.positionId } });
  const doc = await db.positionDocument.create({
    data: {
      positionId: data.positionId,
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
  return { id: doc.id, positionId: doc.positionId, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function updatePositionDocument(
  id: string,
  data: { name?: string; placeholders?: string; pdfData?: string; requiresSignature?: boolean; requiresFill?: boolean; requiresCountersignature?: boolean; countersignerId?: string | null }
) {
  const doc = await db.positionDocument.update({ where: { id }, data });
  revalidatePath("/settings");
  return { id: doc.id, positionId: doc.positionId, name: doc.name, placeholders: doc.placeholders, order: doc.order };
}

export async function deletePositionDocument(id: string) {
  await db.positionDocument.delete({ where: { id } });
  revalidatePath("/settings");
}

/**
 * Position documents for an existing employee, resolved through the candidate
 * record that shares the employee's email (employees don't carry positionId).
 */
export async function getPositionDocumentsForEmployee(employeeId: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { email: true } });
  if (!employee?.email) return [];
  const candidate = await db.candidate.findFirst({
    where: { email: employee.email, positionId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { positionId: true },
  });
  if (!candidate?.positionId) return [];
  const docs = await db.positionDocument.findMany({
    where: { positionId: candidate.positionId },
    select: { id: true, name: true, placeholders: true, requiresSignature: true, requiresFill: true, order: true },
    orderBy: { order: "asc" },
  });
  const withPdf = docs.length > 0
    ? await db.positionDocument.findMany({
        where: { id: { in: docs.map((d) => d.id) }, pdfData: { not: null } },
        select: { id: true },
      })
    : [];
  const pdfSet = new Set(withPdf.map((d) => d.id));
  return docs.map((d) => ({ ...d, hasPdf: pdfSet.has(d.id) }));
}
