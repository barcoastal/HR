import type { BackgroundCheckStatus, BackgroundCheckSummary } from "./types";

/** Display order for filters and summaries. */
export const BACKGROUND_CHECK_STATUSES: BackgroundCheckStatus[] = [
  "AWAITING_APPLICANT",
  "PENDING",
  "PASSED",
  "FAILED",
  "ERROR",
  "NOT_STARTED",
];

/** Same wording as the candidate dialog's background-check panel. */
export const BACKGROUND_CHECK_STATUS_LABELS: Record<BackgroundCheckStatus, string> = {
  NOT_STARTED: "Not started",
  AWAITING_APPLICANT: "Awaiting applicant",
  PENDING: "In progress",
  PASSED: "Passed — Clear",
  FAILED: "Flagged for Review",
  ERROR: "Error",
};

/**
 * Map the free-text `Candidate.backgroundCheckStatus` column onto the module's
 * status set. Null/empty means nothing was ever ordered; anything we don't
 * recognise is surfaced as ERROR rather than silently hidden.
 */
export function deriveBackgroundCheckStatus(raw: string | null | undefined): BackgroundCheckStatus {
  const value = (raw || "").trim().toUpperCase();
  if (!value) return "NOT_STARTED";
  switch (value) {
    case "AWAITING_APPLICANT":
    case "PENDING":
    case "PASSED":
    case "FAILED":
    case "ERROR":
      return value;
    default:
      return "ERROR";
  }
}

/** Checks still waiting on the applicant or on Continental. */
export function isOpenBackgroundCheck(status: BackgroundCheckStatus): boolean {
  return status === "AWAITING_APPLICANT" || status === "PENDING";
}

export function summarizeBackgroundChecks(statuses: BackgroundCheckStatus[]): BackgroundCheckSummary {
  const summary: BackgroundCheckSummary = {
    NOT_STARTED: 0,
    AWAITING_APPLICANT: 0,
    PENDING: 0,
    PASSED: 0,
    FAILED: 0,
    ERROR: 0,
    total: statuses.length,
  };
  for (const status of statuses) summary[status] += 1;
  return summary;
}
