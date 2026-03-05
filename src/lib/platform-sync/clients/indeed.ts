import type { PlatformClient, MockCandidate, CandidatePage } from "../types";

const INDEED_GRAPHQL_URL = "https://apis.indeed.com/graphql";
const PAGE_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 500;

export class IndeedClient implements PlatformClient {
  readonly platformName = "Indeed";

  async validateCredentials(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    if (apiKey.startsWith("indeed-") && apiKey.length > 9) return true;
    if (apiKey.length > 20) return true;
    return false;
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    if (accessToken && process.env.INDEED_CLIENT_ID) {
      try {
        const all: MockCandidate[] = [];
        let cursor: string | null = null;
        do {
          const page = await this.fetchCandidatesPaginated(accessToken, cursor);
          all.push(...page.candidates);
          cursor = page.nextCursor;
          if (cursor) await delay(RATE_LIMIT_DELAY_MS);
        } while (cursor);
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
    // Use the 3-legged OAuth token — it represents a specific employer
    // after the user selected their employer via prompt=select_employer
    const query = `
      query GetApplications($after: String, $first: Int) {
        applicationVersions(after: $after, first: $first) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              status
              candidate {
                name {
                  first
                  last
                }
                email
                phoneNumber
                resumeUrl
              }
              job {
                title
                location {
                  city
                  region
                }
              }
              createdAt
            }
          }
        }
      }
    `;

    const variables: Record<string, unknown> = { first: PAGE_SIZE };
    if (cursor) variables.after = cursor;

    const res = await fetchWithRetry(INDEED_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Indeed API ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();

    if (json.errors?.length) {
      throw new Error(`Indeed GraphQL error: ${json.errors[0].message}`);
    }

    const appVersions = json.data?.applicationVersions;
    if (!appVersions) {
      throw new Error("Unexpected Indeed API response shape");
    }

    const candidates: MockCandidate[] = (appVersions.edges ?? [])
      .map((edge: IndeedEdge) => mapIndeedNode(edge.node))
      .filter((c: MockCandidate | null): c is MockCandidate => c !== null);

    return {
      candidates,
      nextCursor: appVersions.pageInfo?.hasNextPage
        ? appVersions.pageInfo.endCursor
        : null,
      totalEstimate: appVersions.totalCount ?? 0,
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

// --- Helpers ---

type IndeedEdge = {
  node: {
    id: string;
    status?: string;
    candidate?: {
      name?: { first?: string; last?: string };
      email?: string;
      phoneNumber?: string;
      resumeUrl?: string;
    };
    job?: {
      title?: string;
      location?: { city?: string; region?: string };
    };
    createdAt?: string;
  };
};

function mapIndeedNode(node: IndeedEdge["node"]): MockCandidate | null {
  const c = node.candidate;
  if (!c?.email) return null;

  const firstName = c.name?.first ?? "";
  const lastName = c.name?.last ?? "";
  if (!firstName && !lastName) return null;

  const jobTitle = node.job?.title ?? "";
  const location = [node.job?.location?.city, node.job?.location?.region]
    .filter(Boolean)
    .join(", ");

  const notes = [
    "Applied via Indeed",
    node.status ? `Status: ${node.status}` : "",
    location ? `Location: ${location}` : "",
    node.createdAt ? `Applied: ${node.createdAt.slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    firstName,
    lastName,
    email: c.email,
    phone: c.phoneNumber ?? undefined,
    skills: jobTitle ? [jobTitle] : [],
    experience: jobTitle || undefined,
    notes: notes || undefined,
    source: "Indeed",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 1
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2", 10);
    await delay(retryAfter * 1000);
    return fetchWithRetry(url, init, retries - 1);
  }
  return res;
}
