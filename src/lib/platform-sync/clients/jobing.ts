import type { PlatformClient, MockCandidate, CandidatePage } from "../types";

const BASE_URL = "https://pro.jobing.com/api";

function getCompany() {
  return process.env.NOLIG_COMPANY || "coastal-debt-resolve";
}

function fetchOpts(apiKey: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer token=${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  };
}

type JobingApplicant = {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  resume?: string;
  resume_url?: string;
  applied_at?: string;
  referer?: string;
  job_id?: string;
  requisition_id?: string;
  name?: string;
};

type JobingJob = {
  id: string;
  title: string;
  applicants?: string;
};

async function fetchJobs(apiKey: string): Promise<JobingJob[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/jobs?company=${getCompany()}`,
      fetchOpts(apiKey)
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || data.jobs || [];
  } catch {
    return [];
  }
}

async function fetchJobMap(apiKey: string): Promise<Record<string, string>> {
  const jobs = await fetchJobs(apiKey);
  const map: Record<string, string> = {};
  for (const j of jobs) {
    map[j.id] = j.title;
  }
  return map;
}

export class JobingClient implements PlatformClient {
  readonly platformName = "Jobing";
  private jobMap: Record<string, string> = {};
  private cachedJobs: JobingJob[] = [];
  private seenEmails: Set<string> = new Set();

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE_URL}/jobs?company=${getCompany()}`,
        fetchOpts(apiKey)
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    const token = accessToken || process.env.NOLIG_API_KEY || "";
    const jobs = await fetchJobs(token);
    const jobMap: Record<string, string> = {};
    for (const j of jobs) jobMap[j.id] = j.title;

    const seenEmails = new Set<string>();
    const all: MockCandidate[] = [];

    // First: pull from bulk endpoint (up to 1000)
    let page = 1;
    while (true) {
      const bulkUrl = `${BASE_URL}/applicants/bulk?company=${getCompany()}&page=${page}`;
      console.log(`[Jobing] Fetching bulk page ${page}: ${bulkUrl}`);
      const res = await fetch(bulkUrl, fetchOpts(token));
      if (!res.ok) {
        console.log(`[Jobing] Bulk page ${page} failed: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const applicants: JobingApplicant[] = Array.isArray(data)
        ? data
        : data.results || data.applicants || [];

      console.log(`[Jobing] Bulk page ${page}: ${applicants.length} applicants`);
      if (applicants.length === 0) break;

      for (const a of applicants) {
        const mc = mapApplicant(a, jobMap);
        if (!seenEmails.has(mc.email)) {
          seenEmails.add(mc.email);
          all.push(mc);
        }
      }

      page++;
      if (page > 100) break;
    }

    // Second: pull from each job's applicants endpoint to catch those beyond bulk limit
    for (const job of jobs) {
      const appUrl = job.applicants;
      if (!appUrl) continue;
      try {
        const res = await fetch(appUrl, fetchOpts(token));
        if (!res.ok) continue;
        const data = await res.json();
        const applicants: JobingApplicant[] = Array.isArray(data)
          ? data
          : data.results || data.applicants || [];
        for (const a of applicants) {
          const mc = mapApplicant(a, jobMap);
          if (!seenEmails.has(mc.email)) {
            seenEmails.add(mc.email);
            all.push(mc);
          }
        }
      } catch {
        // Skip failed job fetches
      }
    }

    return all;
  }

  async fetchCandidatesPaginated(
    accessToken: string,
    cursor?: string | null
  ): Promise<CandidatePage> {
    // Cursor format:
    //   null / "bulk:1" = start of bulk pagination
    //   "bulk:N"        = continue bulk on page N
    //   "job:IDX"       = walking per-job /applicants endpoints (IDX is job index)
    // Bulk endpoint caps around 1000 applicants; per-job endpoints catch the rest.
    const parsed = parseCursor(cursor);

    // First call: prime jobs + map, reset dedup
    if (!cursor) {
      this.cachedJobs = await fetchJobs(accessToken);
      this.jobMap = {};
      for (const j of this.cachedJobs) this.jobMap[j.id] = j.title;
      this.seenEmails = new Set();
    }

    if (parsed.phase === "bulk") {
      const page = parsed.index;
      const res = await fetch(
        `${BASE_URL}/applicants/bulk?company=${getCompany()}&page=${page}`,
        fetchOpts(accessToken)
      );
      if (!res.ok) {
        return this.advanceToJobsPhase(0);
      }
      const data = await res.json();
      const applicants: JobingApplicant[] = Array.isArray(data)
        ? data
        : data.results || data.applicants || [];

      if (applicants.length === 0) {
        // Bulk exhausted — move on to per-job walk
        return this.advanceToJobsPhase(0);
      }

      const candidates: MockCandidate[] = [];
      for (const a of applicants) {
        const mc = mapApplicant(a, this.jobMap);
        if (this.seenEmails.has(mc.email)) continue;
        this.seenEmails.add(mc.email);
        candidates.push(mc);
      }

      const totalEstimate = data.total || data.count || 0;
      return { candidates, nextCursor: `bulk:${page + 1}`, totalEstimate };
    }

    // phase === "job"
    const jobIdx = parsed.index;
    if (jobIdx >= this.cachedJobs.length) {
      return { candidates: [], nextCursor: null, totalEstimate: 0 };
    }
    const job = this.cachedJobs[jobIdx];
    let candidates: MockCandidate[] = [];
    if (job.applicants) {
      try {
        const res = await fetch(job.applicants, fetchOpts(accessToken));
        if (res.ok) {
          const data = await res.json();
          const applicants: JobingApplicant[] = Array.isArray(data)
            ? data
            : data.results || data.applicants || [];
          candidates = [];
          for (const a of applicants) {
            const mc = mapApplicant(a, this.jobMap);
            if (this.seenEmails.has(mc.email)) continue;
            this.seenEmails.add(mc.email);
            candidates.push(mc);
          }
        }
      } catch {
        // Skip this job's failures and continue to the next
      }
    }
    const nextIdx = jobIdx + 1;
    const nextCursor = nextIdx < this.cachedJobs.length ? `job:${nextIdx}` : null;
    return { candidates, nextCursor, totalEstimate: 0 };
  }

  private advanceToJobsPhase(jobIdx: number): CandidatePage {
    if (jobIdx >= this.cachedJobs.length) {
      return { candidates: [], nextCursor: null, totalEstimate: 0 };
    }
    return { candidates: [], nextCursor: `job:${jobIdx}`, totalEstimate: 0 };
  }
}

function parseCursor(cursor?: string | null): { phase: "bulk" | "job"; index: number } {
  if (!cursor) return { phase: "bulk", index: 1 };
  // Back-compat: plain numeric cursor means bulk page
  if (/^\d+$/.test(cursor)) return { phase: "bulk", index: parseInt(cursor, 10) };
  const [phase, idx] = cursor.split(":");
  if (phase === "bulk") return { phase: "bulk", index: parseInt(idx, 10) || 1 };
  if (phase === "job") return { phase: "job", index: parseInt(idx, 10) || 0 };
  return { phase: "bulk", index: 1 };
}

export async function postJobToJobing(job: {
  title: string;
  description?: string;
  requirements?: string;
  salary?: string;
  departmentName?: string;
}): Promise<{ jobId: string | null; error?: string }> {
  const apiKey = process.env.NOLIG_API_KEY || "";
  if (!apiKey) {
    return { jobId: null, error: "NOLIG_API_KEY not configured" };
  }

  try {
    const payload: Record<string, string> = {
      title: job.title,
      company: getCompany(),
    };
    if (job.description) payload.description = job.description;
    if (job.requirements) payload.requirements = job.requirements;
    if (job.salary) payload.salary = job.salary;
    if (job.departmentName) payload.department = job.departmentName;

    const res = await fetch(`${BASE_URL}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer token=${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { jobId: null, error: `Jobing API error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const jobId = data.id || data.job_id || null;
    return { jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { jobId: null, error: message };
  }
}

function mapApplicant(a: JobingApplicant, jobMap: Record<string, string> = {}): MockCandidate {
  const resumeUrl = a.resume || a.resume_url || undefined;
  const jobTitle = a.job_id ? jobMap[a.job_id] : undefined;

  return {
    firstName: a.first_name || "",
    lastName: a.last_name || "",
    email: a.email || `unknown-${a.id || Math.random().toString(36).slice(2)}@jobing.local`,
    phone: a.phone || undefined,
    skills: [],
    experience: jobTitle ? `Applied for: ${jobTitle}` : undefined,
    notes: a.referer ? `Referrer: ${a.referer}` : undefined,
    source: "pro.jobing",
    resumeUrl,
    appliedAt: a.applied_at || undefined,
    jobAppliedTo: jobTitle,
  };
}
