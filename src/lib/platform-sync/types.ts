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
  skipped: number;
  page: number;
  total: number;
};

export interface PlatformClient {
  readonly platformName: string;
  validateCredentials(apiKey: string): Promise<boolean>;
  fetchCandidates(accessToken?: string): Promise<MockCandidate[]>;
  fetchCandidatesPaginated?(
    accessToken: string,
    cursor?: string | null
  ): Promise<CandidatePage>;
}
