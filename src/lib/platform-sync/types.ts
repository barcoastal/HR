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

export interface PlatformClient {
  readonly platformName: string;
  validateCredentials(apiKey: string): Promise<boolean>;
  fetchCandidates(accessToken?: string): Promise<MockCandidate[]>;
}
