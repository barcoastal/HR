"use server";

import { db } from "@/lib/db";
import { assertCandidateAccess, requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

export async function sendPreAdverseActionNotice(
  candidateId: string,
  reason?: string,
  responseWindowBusinessDays = 5
): Promise<{
  success: boolean;
  status?: string;
  sentAt?: string;
  dueAt?: string;
  error?: string;
}> {
  await requireAuth();
  await assertCandidateAccess(candidateId);
  const responseDays = Math.max(1, Math.min(30, Math.round(responseWindowBusinessDays)));
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: { select: { title: true } } },
  });
  if (!candidate) return { success: false, error: "Candidate not found" };
  if (!candidate.email) return { success: false, error: "Candidate has no email on file" };
  if (candidate.backgroundCheckStatus !== "FAILED") {
    return { success: false, error: "The background report must be flagged for review before sending this notice" };
  }
  if (!candidate.backgroundReportFilename) {
    return {
      success: false,
      error: "The background report PDF is not available yet. Refresh the Continental status or use the portal backup.",
    };
  }

  const report = await db.fileBlob.findUnique({
    where: { filename: candidate.backgroundReportFilename },
    select: { data: true },
  });
  if (!report) return { success: false, error: "The saved background report could not be found" };

  const sentAt = new Date();
  const dueAt = addBusinessDays(sentAt, responseDays);
  try {
    const { sendPreAdverseActionEmail } = await import("@/lib/email");
    const delivery = await sendPreAdverseActionEmail({
      to: candidate.email,
      firstName: candidate.firstName || "there",
      positionTitle: candidate.position?.title,
      reason,
      responseDueAt: dueAt,
      report: Buffer.from(report.data),
      candidateId,
    });

    if (!delivery.success) {
      await db.candidate.update({
        where: { id: candidateId },
        data: {
          preAdverseActionStatus: "FAILED",
          preAdverseActionError: delivery.error || "Email provider rejected the notice",
        },
      });
      return { success: false, status: "FAILED", error: delivery.error || "Failed to send notice" };
    }

    await db.candidate.update({
      where: { id: candidateId },
      data: {
        preAdverseActionStatus: delivery.status,
        preAdverseActionSentAt: sentAt,
        preAdverseActionDueAt: dueAt,
        preAdverseActionProviderId: delivery.providerId || null,
        preAdverseActionError: null,
      },
    });
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.pre_adverse_action.sent",
      entityType: "candidate",
      entityId: candidateId,
      details: {
        name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        responseWindowBusinessDays: responseDays,
        responseDueAt: dueAt.toISOString(),
        providerStatus: delivery.status,
      },
    });
    revalidatePath("/cv");
    return {
      success: true,
      status: delivery.status,
      sentAt: sentAt.toISOString(),
      dueAt: dueAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notice";
    await db.candidate.update({
      where: { id: candidateId },
      data: { preAdverseActionStatus: "FAILED", preAdverseActionError: message },
    }).catch(() => undefined);
    return { success: false, status: "FAILED", error: message };
  }
}

export async function sendAdverseActionLetter(
  candidateId: string,
  reason?: string,
  options?: { force?: boolean }
): Promise<{ success: boolean; error?: string; alreadySent?: boolean }> {
  await requireAuth();
  await assertCandidateAccess(candidateId);
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: { select: { title: true } } },
  });
  if (!candidate) return { success: false, error: "Candidate not found" };
  if (!candidate.email) return { success: false, error: "Candidate has no email on file" };

  if (!candidate.preAdverseActionSentAt || !candidate.preAdverseActionDueAt) {
    return { success: false, error: "Send the pre-adverse action notice before the final adverse-action letter" };
  }
  if (candidate.preAdverseActionDueAt.getTime() > Date.now()) {
    return {
      success: false,
      error: `The response period ends on ${candidate.preAdverseActionDueAt.toLocaleDateString()}`,
    };
  }

  if (candidate.adverseActionLetterSentAt && !options?.force) {
    return { success: false, alreadySent: true, error: "Letter was already sent on " + candidate.adverseActionLetterSentAt.toLocaleDateString() };
  }

  try {
    const { sendAdverseActionEmail } = await import("@/lib/email");
    const delivery = await sendAdverseActionEmail({
      to: candidate.email,
      firstName: candidate.firstName || "there",
      positionTitle: candidate.position?.title,
      reason,
      candidateId,
    });
    if (!delivery.success) {
      return { success: false, error: delivery.error || "Email provider rejected the letter" };
    }
    const previousStatus = candidate.status;
    await db.candidate.update({
      where: { id: candidateId },
      data: {
        adverseActionLetterSentAt: new Date(),
        backgroundCheckStatus: "FAILED",
        status: "REJECTED",
        doNotCall: true,
        doNotCallReason: candidate.doNotCallReason || "Background check failed",
        doNotCallAt: candidate.doNotCallAt || new Date(),
      },
    });
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.status.changed",
      entityType: "candidate",
      entityId: candidateId,
      details: {
        name: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        from: previousStatus,
        to: "REJECTED",
        via: "adverse_action_letter",
        reason: reason ?? null,
      },
    });
    revalidatePath("/cv");
    return { success: true };
  } catch (err) {
    console.error("[adverse-action]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to send letter" };
  }
}
