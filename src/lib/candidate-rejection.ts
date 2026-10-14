// Client-safe (no server/DB imports). The standard rejection dispositions a
// candidate must be given when moved to REJECTED. This is the one list to edit
// when the team wants to add, rename, or retire a reason — codes are stored on
// Candidate.rejectionReason and CandidateStageEvent.reason, so keep existing
// codes stable and change only labels.

export const REJECTION_REASONS = [
  { code: "NO_SHOW", label: "No-show" },
  { code: "FAILED_INTERVIEW", label: "Failed interview" },
  { code: "WITHDREW", label: "Withdrew" },
  { code: "NOT_QUALIFIED", label: "Not qualified" },
  { code: "SALARY_MISMATCH", label: "Salary mismatch" },
  { code: "FAILED_BACKGROUND_CHECK", label: "Failed background check" },
  { code: "WENT_WITH_ANOTHER_CANDIDATE", label: "Went with another candidate" },
  { code: "NO_LINKEDIN_PROFILE", label: "No LinkedIn profile" },
  { code: "OTHER", label: "Other" },
] as const;

export type RejectionReasonCode = (typeof REJECTION_REASONS)[number]["code"];

/** Codes whose note is mandatory. */
export const REJECTION_REASONS_REQUIRING_NOTE: readonly RejectionReasonCode[] = ["OTHER"];

export const REJECTION_NOTE_MAX_LENGTH = 500;

const LABEL_BY_CODE = new Map<string, string>(REJECTION_REASONS.map((r) => [r.code, r.label]));

export function isRejectionReasonCode(value: unknown): value is RejectionReasonCode {
  return typeof value === "string" && LABEL_BY_CODE.has(value);
}

/** Human label for a stored code; unknown/legacy codes fall back to the raw value. */
export function rejectionReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LABEL_BY_CODE.get(code) ?? code;
}

export type RejectionInput = { reason?: string | null; note?: string | null };

export type ValidatedRejection = { reason: RejectionReasonCode; note: string | null };

/**
 * Validate a rejection disposition. Returns the normalized reason + note, or
 * an error message suitable for showing to the user.
 */
export function validateRejection(
  input: RejectionInput | null | undefined,
): { ok: true; value: ValidatedRejection } | { ok: false; error: string } {
  const reason = input?.reason?.trim();
  if (!reason) return { ok: false, error: "Pick a rejection reason before moving this candidate to Rejected." };
  if (!isRejectionReasonCode(reason)) return { ok: false, error: "That rejection reason isn't on the standard list." };
  const note = (input?.note ?? "").trim();
  if (note.length > REJECTION_NOTE_MAX_LENGTH) {
    return { ok: false, error: `Keep the rejection note under ${REJECTION_NOTE_MAX_LENGTH} characters.` };
  }
  if (REJECTION_REASONS_REQUIRING_NOTE.includes(reason) && !note) {
    return { ok: false, error: "Add a short note explaining the “Other” reason." };
  }
  return { ok: true, value: { reason, note: note || null } };
}

/**
 * Reason codes whose label matches a search token (case-, space- and
 * punctuation-insensitive). Used by global search so "linkedin" finds
 * candidates rejected for "No LinkedIn profile".
 */
export function rejectionReasonsMatchingToken(token: string): RejectionReasonCode[] {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length < 2) return [];
  return REJECTION_REASONS.filter((r) =>
    r.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized),
  ).map((r) => r.code);
}

export type RejectionFields = {
  rejectionReason?: string | null;
  rejectionNote?: string | null;
  rejectedAt?: Date | null;
};

/**
 * Decide what a status move does to the candidate's rejection fields:
 * - entering REJECTED requires a valid disposition and stamps it;
 * - staying REJECTED with a reason supplied updates the disposition;
 * - leaving REJECTED clears it (the stage history keeps the old reason);
 * - anything else leaves the fields alone.
 */
export function resolveRejectionUpdate(params: {
  previousStatus: string | null | undefined;
  nextStatus: string;
  rejection?: RejectionInput | null;
  previousRejectedAt?: Date | null;
  now?: Date;
}): { ok: true; data: RejectionFields; reason: ValidatedRejection | null } | { ok: false; error: string } {
  const { previousStatus, nextStatus, rejection } = params;
  const now = params.now ?? new Date();
  if (nextStatus === "REJECTED") {
    const entering = previousStatus !== "REJECTED";
    if (!entering && !rejection?.reason) return { ok: true, data: {}, reason: null };
    const v = validateRejection(rejection);
    if (!v.ok) return v;
    return {
      ok: true,
      reason: v.value,
      data: {
        rejectionReason: v.value.reason,
        rejectionNote: v.value.note,
        rejectedAt: entering ? now : (params.previousRejectedAt ?? now),
      },
    };
  }
  if (previousStatus === "REJECTED") {
    return { ok: true, reason: null, data: { rejectionReason: null, rejectionNote: null, rejectedAt: null } };
  }
  return { ok: true, data: {}, reason: null };
}

/** Rejection fields to clear when a candidate moves out of REJECTED by a path that sets status directly. */
export function clearedRejectionIfLeaving(previousStatus: string | null | undefined): RejectionFields {
  return previousStatus === "REJECTED" ? { rejectionReason: null, rejectionNote: null, rejectedAt: null } : {};
}
