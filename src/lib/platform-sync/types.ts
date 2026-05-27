export type MockCandidate = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  skills: string[];
  experience?: string;
  notes?: string;
  source: string;
  resumeUrl?: string;
  appliedAt?: string;
  jobAppliedTo?: string;
  // Used to resolve to a local Position via PositionBoardPosting
  externalPlatform?: string; // "BREEZY" | "JOBING" | etc.
  externalPositionId?: string;
};

export type CandidatePage = {
  candidates: MockCandidate[];
  nextCursor: string | null;
  totalEstimate: number;
};

export type SyncProgressEvent = {
  type: "progress" | "complete" | "error";
  detail?: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  page: number;
  total: number;
  resumesDownloaded?: number;
  resumesFailed?: number;
};

export interface PlatformClient {
  readonly platformName: string;
  validateCredentials(apiKey: string): Promise<boolean>;
  fetchCandidates(accessToken?: string): Promise<MockCandidate[]>;
  fetchCandidatesPaginated?(
    accessToken: string,
    cursor?: string | null,
    opts?: { knownEmails?: Set<string> }
  ): Promise<CandidatePage>;
}
