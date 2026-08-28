/**
 * Shared types for the Background Checks module. Dates travel as ISO strings
 * so rows serialise identically as page props and as server-action results.
 */

export type BackgroundCheckStatus =
  | "NOT_STARTED"
  | "AWAITING_APPLICANT"
  | "PENDING"
  | "PASSED"
  | "FAILED"
  | "ERROR";

export type BackgroundCheckRow = {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  positionTitle: string | null;
  recruiterName: string | null;
  status: BackgroundCheckStatus;
  /** Raw `backgroundCheckStatus` on the candidate — shown when it maps to ERROR. */
  rawStatus: string | null;
  /** `backgroundCheckDate` — when the invitation/order was sent. */
  sentAt: string | null;
  /** `backgroundCheckId`: an `INV-` invitation key until Continental assigns an OrderID. */
  checkId: string | null;
  isInvitation: boolean;
  /** Report PDF URL, present once the postback delivered the PDF. */
  reportUrl: string | null;
  reportImportedAt: string | null;
  preAdverseActionStatus: string | null;
  preAdverseActionSentAt: string | null;
  preAdverseActionDueAt: string | null;
  adverseActionLetterSentAt: string | null;
  updatedAt: string;
};

export type BackgroundCheckSummary = Record<BackgroundCheckStatus, number> & { total: number };

export type BackgroundCheckList = {
  rows: BackgroundCheckRow[];
  summary: BackgroundCheckSummary;
};

export type ProviderSearch = {
  id: string | null;
  name: string;
  status: string | null;
  recordsFound: number | null;
  /** Any records found — the search flags the order for review. */
  flagged: boolean;
  notes: string | null;
};

export type ProviderOrder = {
  orderId: string | null;
  status: string | null;
  searches: ProviderSearch[];
};

export type ProviderInvitation = {
  id: string | null;
  status: string | null;
  applicantEmail: string | null;
  createdAt: string | null;
  /** null until the applicant completes the invitation form. */
  signedAt: string | null;
  orderId: string | null;
};

export type BackgroundCheckDetail = {
  row: BackgroundCheckRow;
  providerConfigured: boolean;
  /** Why no live data was fetched (sandbox / legacy key / nothing linked). Not an error. */
  providerNote: string | null;
  /** Continental call failed — message for the UI, never thrown. */
  providerError: string | null;
  order: ProviderOrder | null;
  invitation: ProviderInvitation | null;
  fetchedAt: string;
};

export type RefreshBackgroundCheckResult = {
  row: BackgroundCheckRow;
  changed: boolean;
  previousStatus: BackgroundCheckStatus;
  /** Set when an invitation key was upgraded to a real OrderID during this refresh. */
  linkedOrderId: string | null;
  providerError: string | null;
};

export type RefreshPendingResult = {
  refreshed: number;
  changed: number;
  /** Open checks that aren't Continental orders (sandbox / legacy keys). */
  skipped: number;
  errors: { candidateId: string | null; name: string; error: string }[];
};

export type SimulateBackgroundCheckResult = {
  row: BackgroundCheckRow;
  changed: boolean;
};
