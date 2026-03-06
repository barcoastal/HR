import type { PlatformClient, MockCandidate, CandidatePage } from "../types";

const BASE_URL = "https://pro.jobing.com/api";

function getCompany() {
  return process.env.NOLIG_COMPANY || "coastal-debt-resolve";
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer token=${apiKey}`,
    Accept: "application/json",
  };
}

type JobingApplicant = {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  resume_url?: string;
  applied_at?: string;
  referer?: string;
};

export class JobingClient implements PlatformClient {
  readonly platformName = "Jobing";

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE_URL}/jobs?company=${getCompany()}`,
        { headers: authHeaders(apiKey) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    const token = accessToken || process.env.NOLIG_API_KEY || "";
    const all: MockCandidate[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `${BASE_URL}/applicants/bulk?company=${getCompany()}&page=${page}`,
        { headers: authHeaders(token) }
      );
      if (!res.ok) break;

      const data = await res.json();
      const applicants: JobingApplicant[] = Array.isArray(data)
        ? data
        : data.results || data.applicants || [];

      if (applicants.length === 0) break;

      for (const a of applicants) {
        all.push(mapApplicant(a));
      }

      page++;
      if (page > 100) break; // safety limit
    }

    return all;
  }

  async fetchCandidatesPaginated(
    accessToken: string,
    cursor?: string | null
  ): Promise<CandidatePage> {
    const page = cursor ? parseInt(cursor, 10) : 1;

    const res = await fetch(
      `${BASE_URL}/applicants/bulk?company=${getCompany()}&page=${page}`,
      { headers: authHeaders(accessToken) }
    );

    if (!res.ok) {
      return { candidates: [], nextCursor: null, totalEstimate: 0 };
    }

    const data = await res.json();
    const applicants: JobingApplicant[] = Array.isArray(data)
      ? data
      : data.results || data.applicants || [];

    const totalEstimate = data.total || data.count || 0;
    const candidates = applicants.map(mapApplicant);

    const hasMore = applicants.length > 0;
    const nextCursor = hasMore ? String(page + 1) : null;

    return { candidates, nextCursor, totalEstimate };
  }
}

function mapApplicant(a: JobingApplicant): MockCandidate {
  return {
    firstName: a.first_name || "",
    lastName: a.last_name || "",
    email: a.email || `unknown-${a.id || Math.random().toString(36).slice(2)}@jobing.local`,
    phone: a.phone || undefined,
    skills: [],
    experience: undefined,
    notes: a.referer ? `Referrer: ${a.referer}` : undefined,
    source: "pro.jobing",
    resumeUrl: a.resume_url || undefined,
    appliedAt: a.applied_at || undefined,
  };
}
