import { db } from "@/lib/db";
import type { CandidateStatus } from "@/generated/prisma/client";

export type StageEventInput = {
  candidateId: string;
  fromStatus: CandidateStatus | null;
  toStatus: CandidateStatus;
  fromStageId?: string | null;
  toStageId?: string | null;
  reason?: string | null;
  note?: string | null;
  source?: string;
  changedById?: string | null;
};

/** True when a move changed the base status or the custom pipeline stage. */
export function isStageChange(e: Pick<StageEventInput, "fromStatus" | "toStatus" | "fromStageId" | "toStageId">): boolean {
  return e.fromStatus !== e.toStatus || (e.fromStageId ?? null) !== (e.toStageId ?? null);
}

/**
 * Append one row to the candidate's stage history. Never throws — history is
 * best-effort and must not block the move the user just made.
 */
export async function recordStageEvent(e: StageEventInput): Promise<void> {
  if (!isStageChange(e)) return;
  try {
    await db.candidateStageEvent.create({
      data: {
        candidateId: e.candidateId,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        fromStageId: e.fromStageId ?? null,
        toStageId: e.toStageId ?? null,
        reason: e.reason ?? null,
        note: e.note ?? null,
        source: e.source ?? null,
        changedById: e.changedById ?? null,
      },
    });
  } catch (err) {
    console.error("[stage-events] could not record stage change:", err);
  }
}

/** Same, for many candidates moved together (e.g. DNC propagation). */
export async function recordStageEvents(events: StageEventInput[]): Promise<void> {
  const rows = events.filter(isStageChange);
  if (rows.length === 0) return;
  try {
    await db.candidateStageEvent.createMany({
      data: rows.map((e) => ({
        candidateId: e.candidateId,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        fromStageId: e.fromStageId ?? null,
        toStageId: e.toStageId ?? null,
        reason: e.reason ?? null,
        note: e.note ?? null,
        source: e.source ?? null,
        changedById: e.changedById ?? null,
      })),
    });
  } catch (err) {
    console.error("[stage-events] could not record stage changes:", err);
  }
}

/** The user id to attribute a change to, or null when there's no session. */
export async function currentUserId(): Promise<string | null> {
  try {
    const { getSession } = await import("@/lib/auth-helpers");
    const session = await getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}
