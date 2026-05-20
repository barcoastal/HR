"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function sendAdverseActionLetter(
  candidateId: string,
  reason?: string,
  options?: { force?: boolean }
): Promise<{ success: boolean; error?: string; alreadySent?: boolean }> {
  await requireAuth();
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: { select: { title: true } } },
  });
  if (!candidate) return { success: false, error: "Candidate not found" };
  if (!candidate.email) return { success: false, error: "Candidate has no email on file" };

  if (candidate.adverseActionLetterSentAt && !options?.force) {
    return { success: false, alreadySent: true, error: "Letter was already sent on " + candidate.adverseActionLetterSentAt.toLocaleDateString() };
  }

  try {
    const { sendAdverseActionEmail } = await import("@/lib/email");
    await sendAdverseActionEmail({
      to: candidate.email,
      firstName: candidate.firstName || "there",
      positionTitle: candidate.position?.title,
      reason,
    });
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
