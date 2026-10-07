"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPositionDocuments(positionId: string) {
  return db.positionDocument.findMany({
    where: { positionId },
    orderBy: { order: "asc" },
  });
}

const POSITION_DOC_SELECT = {
  id: true,
  name: true,
  pdfData: true,
  placeholders: true,
  requiresSignature: true,
  requiresFill: true,
  requiresCountersignature: true,
  countersignerId: true,
} as const;

/**
 * Position documents send only at Written Offer, and they are stored on a
 * specific Position row. Hires often sit on a different Retention Specialist
 * req with the same title, or the employee email no longer matches the
 * candidate — so look up by position id, applications, and job title.
 */
export async function resolvePositionDocumentsForWrittenOffer(opts: {
  positionId?: string | null;
  candidateEmail?: string | null;
  jobTitle?: string | null;
}) {
  const ids = new Set<string>();
  if (opts.positionId) ids.add(opts.positionId);

  const email = opts.candidateEmail?.trim();
  let title = opts.jobTitle?.trim() || "";

  if (email) {
    const candidate = await db.candidate.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: {
        positionId: true,
        jobAppliedTo: true,
        applications: { select: { positionId: true } },
      },
    });
    if (candidate?.positionId) ids.add(candidate.positionId);
    for (const application of candidate?.applications ?? []) {
      if (application.positionId) ids.add(application.positionId);
    }
    if (!title && candidate?.jobAppliedTo) title = candidate.jobAppliedTo.trim();
  }

  if (title) {
    const matchingPositions = await db.position.findMany({
      where: { title: { equals: title, mode: "insensitive" } },
      select: { id: true },
    });
    for (const position of matchingPositions) ids.add(position.id);
  }

  if (ids.size === 0) return [];

  const docs = await db.positionDocument.findMany({
    where: { positionId: { in: [...ids] } },
    select: POSITION_DOC_SELECT,
    orderBy: [{ positionId: "asc" }, { order: "asc" }],
  });

  // Same title can have several open reqs; keep one doc per name so we do not
  // email the compensation plan twice.
  const seen = new Set<string>();
  return docs.filter((doc) => {
    const key = doc.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
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
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { email: true, jobTitle: true },
  });
  if (!employee) return [];
  const docs = await resolvePositionDocumentsForWrittenOffer({
    candidateEmail: employee.email,
    jobTitle: employee.jobTitle,
  });
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    placeholders: d.placeholders,
    requiresSignature: d.requiresSignature,
    requiresFill: d.requiresFill,
    hasPdf: Boolean(d.pdfData),
  }));
}
