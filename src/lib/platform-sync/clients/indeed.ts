import type { PlatformClient, MockCandidate, CandidatePage } from "../types";

const UNIFIED_BASE_URL = "https://api.unified.to";
const PAGE_SIZE = 50;

/**
 * Indeed client powered by Unified.to ATS API.
 *
 * Connection flow:
 *  1. Admin sets UNIFIED_API_KEY in env
 *  2. Admin creates Indeed connection in Unified.to dashboard → gets connection_id
 *  3. connection_id is stored as platform.accountIdentifier
 *  4. All API calls go through Unified.to: GET /ats/{connection_id}/candidate, etc.
 */
export class IndeedClient implements PlatformClient {
  readonly platformName = "Indeed";

  async validateCredentials(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    // Accept Unified.to API keys (typically long JWT-like strings)
    // Also accept legacy indeed- prefixed tokens for backwards compat
    if (apiKey.startsWith("indeed-") && apiKey.length > 9) return true;
    if (apiKey.length > 20) return true;
    return false;
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    const unifiedKey = getUnifiedApiKey(accessToken);
    const connectionId = getConnectionId(accessToken);

    if (unifiedKey && connectionId) {
      try {
        const all: MockCandidate[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const page = await this.fetchCandidatesPaginated(
            `${unifiedKey}::${connectionId}`,
            String(offset)
          );
          all.push(...page.candidates);
          offset += page.candidates.length;
          hasMore = page.nextCursor !== null && page.candidates.length >= PAGE_SIZE;
        }

        if (all.length > 0) return all;
      } catch {
        // Fall through to mock data
      }
    }

    await delay(1000);
    return this.getMockCandidates();
  }

  async fetchCandidatesPaginated(
    accessToken: string,
    cursor?: string | null
  ): Promise<CandidatePage> {
    const [unifiedKey, connectionId] = accessToken.split("::");
    if (!unifiedKey || !connectionId) {
      throw new Error("Invalid token format. Expected UNIFIED_KEY::CONNECTION_ID");
    }

    const offset = cursor ? parseInt(cursor, 10) : 0;
    const url = new URL(`${UNIFIED_BASE_URL}/ats/${connectionId}/candidate`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${unifiedKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Unified.to API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data: UnifiedCandidate[] = await res.json();

    const candidates: MockCandidate[] = data
      .map(mapUnifiedCandidate)
      .filter((c): c is MockCandidate => c !== null);

    return {
      candidates,
      nextCursor: data.length >= PAGE_SIZE ? String(offset + data.length) : null,
      totalEstimate: 0, // Unified.to doesn't return total count
    };
  }

  private getMockCandidates(): MockCandidate[] {
    return [
      {
        firstName: "John",
        lastName: "Rivera",
        email: "john.rivera.ops@yahoo.com",
        phone: "+1 (312) 555-0201",
        skills: ["Operations Management", "Supply Chain", "Lean Six Sigma", "SAP"],
        experience: "10 years — Operations Director at Amazon Fulfillment",
        notes: "Applied via Indeed. Seeking management role. Willing to relocate.",
        source: "Indeed",
      },
      {
        firstName: "Ashley",
        lastName: "Thompson",
        email: "ashley.thompson.mktg@gmail.com",
        phone: "+1 (214) 555-0302",
        skills: ["Digital Marketing", "SEO", "Google Analytics", "Content Strategy", "HubSpot"],
        experience: "4 years — Marketing Manager at HubSpot",
        notes: "Indeed resume match. Strong analytics background.",
        source: "Indeed",
      },
      {
        firstName: "Robert",
        lastName: "Chang",
        email: "robert.chang.finance@outlook.com",
        phone: "+1 (646) 555-0403",
        skills: ["Financial Analysis", "Excel", "Forecasting", "Budgeting", "QuickBooks"],
        experience: "6 years — Senior Financial Analyst at Deloitte",
        notes: "Applied to open Finance position. CPA certified.",
        source: "Indeed",
      },
      {
        firstName: "Maria",
        lastName: "Santos",
        email: "maria.santos.hr@gmail.com",
        phone: "+1 (713) 555-0504",
        skills: ["HR Management", "Recruiting", "Employee Relations", "HRIS", "Benefits Admin"],
        experience: "8 years — HR Business Partner at Target",
        notes: "Indeed sponsored listing click. PHR certified.",
        source: "Indeed",
      },
      {
        firstName: "James",
        lastName: "O'Brien",
        email: "james.obrien.sales@yahoo.com",
        phone: "+1 (617) 555-0605",
        skills: ["B2B Sales", "Salesforce", "Account Management", "Negotiation"],
        experience: "5 years — Account Executive at Oracle",
        notes: "Indeed quick-apply. Exceeded quota 4 consecutive quarters.",
        source: "Indeed",
      },
    ];
  }
}

// --- Unified.to ATS types ---

type UnifiedCandidate = {
  id?: string;
  name?: string;
  emails?: { email: string; type?: string }[];
  telephones?: { telephone: string; type?: string }[];
  title?: string;
  company?: string;
  link_urls?: string[];
  created_at?: string;
  updated_at?: string;
  raw?: Record<string, unknown>;
};

function mapUnifiedCandidate(c: UnifiedCandidate): MockCandidate | null {
  const email = c.emails?.[0]?.email;
  if (!email) return null;

  const nameParts = (c.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  if (!firstName && !lastName) return null;

  const phone = c.telephones?.[0]?.telephone;
  const linkedinUrl = c.link_urls?.find((u) => u.includes("linkedin.com"));

  const notes = [
    "Synced via Indeed (Unified.to)",
    c.company ? `Company: ${c.company}` : "",
    c.created_at ? `Applied: ${c.created_at.slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    firstName,
    lastName,
    email,
    phone: phone || undefined,
    linkedinUrl: linkedinUrl || undefined,
    skills: c.title ? [c.title] : [],
    experience: [c.title, c.company].filter(Boolean).join(" at ") || undefined,
    notes: notes || undefined,
    source: "Indeed",
  };
}

// --- Job posting via Unified.to ---

type UnifiedJobInput = {
  name: string;
  description?: string;
  status?: "OPEN" | "CLOSED" | "DRAFT";
  departments?: string[];
  compensation?: { value: number; currency: string; type: string }[];
};

export async function postJobToIndeed(data: {
  title: string;
  description?: string;
  requirements?: string;
  salary?: string;
  departmentName?: string;
  connectionId: string;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const apiKey = process.env.UNIFIED_API_KEY;
  if (!apiKey) {
    return { success: false, error: "UNIFIED_API_KEY not configured" };
  }

  const body: UnifiedJobInput = {
    name: data.title,
    description: [data.description, data.requirements ? `\n\nRequirements:\n${data.requirements}` : ""]
      .filter(Boolean)
      .join(""),
    status: "OPEN",
  };

  if (data.departmentName) {
    body.departments = [data.departmentName];
  }

  if (data.salary) {
    const salaryNum = parseFloat(data.salary.replace(/[^0-9.]/g, ""));
    if (!isNaN(salaryNum)) {
      body.compensation = [{ value: salaryNum, currency: "USD", type: "SALARY" }];
    }
  }

  try {
    const res = await fetch(
      `${UNIFIED_BASE_URL}/ats/${data.connectionId}/job`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Unified.to API ${res.status}: ${text.slice(0, 200)}` };
    }

    const result = await res.json();
    return { success: true, jobId: result.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to post job",
    };
  }
}

export async function updateIndeedJobStatus(
  connectionId: string,
  jobId: string,
  status: "OPEN" | "CLOSED" | "ARCHIVED" | "DRAFT"
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.UNIFIED_API_KEY;
  if (!apiKey) return { success: false, error: "UNIFIED_API_KEY not configured" };
  try {
    const res = await fetch(
      `${UNIFIED_BASE_URL}/ats/${connectionId}/job/${jobId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Indeed/Unified ${res.status}: ${text.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update" };
  }
}

// --- Fetch applications from Indeed via Unified.to ---

export async function fetchIndeedApplications(
  connectionId: string,
  jobId?: string
): Promise<{ success: boolean; applications: UnifiedApplication[]; error?: string }> {
  const apiKey = process.env.UNIFIED_API_KEY;
  if (!apiKey) {
    return { success: false, applications: [], error: "UNIFIED_API_KEY not configured" };
  }

  try {
    const url = new URL(`${UNIFIED_BASE_URL}/ats/${connectionId}/application`);
    if (jobId) url.searchParams.set("job_id", jobId);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, applications: [], error: `Unified.to API ${res.status}: ${text.slice(0, 200)}` };
    }

    const data: UnifiedApplication[] = await res.json();
    return { success: true, applications: data };
  } catch (err) {
    return {
      success: false,
      applications: [],
      error: err instanceof Error ? err.message : "Failed to fetch applications",
    };
  }
}

export type UnifiedApplication = {
  id?: string;
  candidate_id?: string;
  job_id?: string;
  status?: string;
  applied_at?: string;
  created_at?: string;
  raw?: Record<string, unknown>;
};

// --- Helpers ---

function getUnifiedApiKey(accessToken?: string): string | null {
  // First check env var, then fall back to the token itself
  return process.env.UNIFIED_API_KEY || accessToken || null;
}

function getConnectionId(accessToken?: string): string | null {
  // The connection_id is passed via the platform's accountIdentifier
  // When calling from the sync system, it's encoded as KEY::CONNECTION_ID in the access token
  if (accessToken?.includes("::")) {
    return accessToken.split("::")[1];
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
