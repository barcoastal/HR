"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { CandidateStatus } from "@/generated/prisma/client";

/**
 * Record an application for a candidate against a position. If the same
 * candidate/position combo already exists, bumps the appliedAt and increments
 * the candidate's applicationCount. Otherwise creates a new application row.
 *
 * Safe to call during bulk upload + when a candidate is pulled into a pipeline.
 */
export async function recordApplication(params: {
  candidateId: string;
  positionId?: string | null;
  positionName: string;
  source?: string | null;
  resumeUrl?: string | null;
}) {
  const { candidateId, positionId, positionName, source, resumeUrl } = params;

  const existing = positionId
    ? await db.candidateApplication.findFirst({
        where: { candidateId, positionId },
      })
    : null;

  if (existing) {
    await db.candidateApplication.update({
      where: { id: existing.id },
      data: { appliedAt: new Date(), resumeUrl: resumeUrl ?? existing.resumeUrl, source: source ?? existing.source },
    });
    await db.candidate.update({
      where: { id: candidateId },
      data: { applicationCount: { increment: 1 } },
    });
    return existing.id;
  }

  const created = await db.candidateApplication.create({
    data: {
      candidateId,
      positionId: positionId ?? null,
      positionName,
      source: source ?? null,
      resumeUrl: resumeUrl ?? null,
      stageHistory: [{ status: "NEW", at: new Date().toISOString() }],
    },
  });
  await db.candidate.update({
    where: { id: candidateId },
    data: { applicationCount: { increment: 1 } },
  });
  return created.id;
}

export async function getCandidateApplications(candidateId: string) {
  return db.candidateApplication.findMany({
    where: { candidateId },
    orderBy: { appliedAt: "desc" },
    include: { position: { select: { title: true, status: true } } },
  });
}

export async function updateApplicationStatus(
  applicationId: string,
  status: CandidateStatus,
  note?: string,
) {
  const session = await requireAuth();
  const application = await db.candidateApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found");

  const history = Array.isArray(application.stageHistory) ? (application.stageHistory as unknown[]) : [];
  history.push({
    status,
    at: new Date().toISOString(),
    by: session.user.employeeId || session.user.id,
    note: note || undefined,
  });

  await db.candidateApplication.update({
    where: { id: applicationId },
    data: { status, stageHistory: history as object },
  });

  revalidatePath("/cv");
  return true;
}

export async function markDoNotCall(candidateId: string, reason?: string) {
  const before = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { firstName: true, lastName: true, email: true, status: true },
  });
  await db.candidate.update({
    where: { id: candidateId },
    data: {
      doNotCall: true,
      doNotCallReason: reason || null,
      doNotCallAt: new Date(),
      status: "REJECTED",
    },
  });
  if (before) {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.status.changed",
      entityType: "candidate",
      entityId: candidateId,
      details: {
        name: `${before.firstName} ${before.lastName}`,
        email: before.email,
        from: before.status,
        to: "REJECTED",
        via: "mark_do_not_call",
        reason: reason ?? null,
      },
    });
  }
  revalidatePath("/cv");
}

export async function unmarkDoNotCall(candidateId: string) {
  await db.candidate.update({
    where: { id: candidateId },
    data: { doNotCall: false, doNotCallReason: null, doNotCallAt: null },
  });
  revalidatePath("/cv");
}
