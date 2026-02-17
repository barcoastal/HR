import type { PlatformClient, MockCandidate } from "../types";

export class IndeedClient implements PlatformClient {
  readonly platformName = "Indeed";

  async validateCredentials(apiKey: string): Promise<boolean> {
    // Accept OAuth tokens (any non-empty string) or legacy prefix-based keys
    if (!apiKey) return false;
    if (apiKey.startsWith("indeed-") && apiKey.length > 9) return true;
    // OAuth tokens are typically longer opaque strings
    if (apiKey.length > 20) return true;
    return false;
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    // If a real OAuth token is provided and Indeed API creds exist,
    // attempt real API call. This serves as the hook point for when
    // Indeed Partner API access is granted.
    if (accessToken && process.env.INDEED_CLIENT_ID) {
      try {
        const candidates = await this.fetchFromIndeedAPI(accessToken);
        if (candidates.length > 0) return candidates;
      } catch {
        // Fall through to mock data
      }
    }

    // Mock fallback
    await new Promise((r) => setTimeout(r, 1000));
    return this.getMockCandidates();
  }

  private async fetchFromIndeedAPI(accessToken: string): Promise<MockCandidate[]> {
    // Indeed Employer API requires Partner approval.
    // When approved, this would call:
    // GET https://apis.indeed.com/employer/v1/applications with the accessToken
    // For now, validate the token is still active
    const res = await fetch("https://apis.indeed.com/oauth/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return [];

    // Token is valid but we don't have Employer API access yet — return empty
    // to trigger mock fallback. When Partner access is granted, implement
    // actual candidate fetching here.
    return [];
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
