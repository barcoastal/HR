import type { PlatformClient, MockCandidate } from "../types";

export class IndeedClient implements PlatformClient {
  readonly platformName = "Indeed";

  async validateCredentials(apiKey: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 600));
    return apiKey.startsWith("indeed-") && apiKey.length > 9;
  }

  async fetchCandidates(): Promise<MockCandidate[]> {
    await new Promise((r) => setTimeout(r, 1000));
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
