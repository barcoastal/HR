import type { PlatformClient, MockCandidate } from "../types";

export class LinkedInRecruiterClient implements PlatformClient {
  readonly platformName = "LinkedIn Recruiter";

  async validateCredentials(apiKey: string): Promise<boolean> {
    // Accept OAuth tokens (any non-empty string) or legacy prefix-based keys
    if (!apiKey) return false;
    if (apiKey.startsWith("li-") && apiKey.length > 5) return true;
    // OAuth tokens are typically longer opaque strings
    if (apiKey.length > 20) return true;
    return false;
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    // If a real OAuth token is provided and LinkedIn RSC API creds exist,
    // attempt real API call. This serves as the hook point for when
    // LinkedIn Recruiter System Connect access is granted.
    if (accessToken && process.env.LINKEDIN_CLIENT_ID) {
      try {
        const candidates = await this.fetchFromLinkedInAPI(accessToken);
        if (candidates.length > 0) return candidates;
      } catch {
        // Fall through to mock data
      }
    }

    // Mock fallback
    await new Promise((r) => setTimeout(r, 1200));
    return this.getMockCandidates();
  }

  private async fetchFromLinkedInAPI(accessToken: string): Promise<MockCandidate[]> {
    // LinkedIn RSC (Recruiter System Connect) API requires partner approval.
    // When approved, this would call:
    // GET https://api.linkedin.com/v2/hiringContext with the accessToken
    // For now, validate the token is still active via userinfo
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return [];

    // Token is valid but we don't have RSC access yet — return empty
    // to trigger mock fallback. When RSC access is granted, implement
    // actual candidate fetching here.
    return [];
  }

  private getMockCandidates(): MockCandidate[] {
    return [
      {
        firstName: "Sarah",
        lastName: "Chen",
        email: "sarah.chen.dev@gmail.com",
        phone: "+1 (415) 555-0123",
        linkedinUrl: "https://linkedin.com/in/sarachen-dev",
        skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
        experience: "7 years — Senior Software Engineer at Stripe",
        notes: "Actively looking. Open to relocation. Strong system design skills.",
        source: "LinkedIn Recruiter",
      },
      {
        firstName: "Marcus",
        lastName: "Williams",
        email: "marcus.w.pm@outlook.com",
        linkedinUrl: "https://linkedin.com/in/marcuswilliams-pm",
        skills: ["Product Management", "Agile", "Data Analysis", "Roadmapping", "SQL"],
        experience: "5 years — Product Manager at Atlassian",
        notes: "LinkedIn InMail response. Interested in startup environment.",
        source: "LinkedIn Recruiter",
      },
      {
        firstName: "Priya",
        lastName: "Patel",
        email: "priya.patel.eng@gmail.com",
        phone: "+1 (650) 555-0456",
        linkedinUrl: "https://linkedin.com/in/priyapatel-fullstack",
        skills: ["Python", "Django", "React", "PostgreSQL", "Docker"],
        experience: "4 years — Full Stack Developer at Shopify",
        notes: "Currently employed, 2-week notice. Excellent references.",
        source: "LinkedIn Recruiter",
      },
      {
        firstName: "David",
        lastName: "Kim",
        email: "david.kim.ux@gmail.com",
        linkedinUrl: "https://linkedin.com/in/davidkim-ux",
        skills: ["UX Design", "Figma", "User Research", "Prototyping", "Design Systems"],
        experience: "6 years — Lead UX Designer at Spotify",
        notes: "Portfolio reviewed. Strong design thinking methodology.",
        source: "LinkedIn Recruiter",
      },
      {
        firstName: "Elena",
        lastName: "Rodriguez",
        email: "elena.rodriguez.devops@gmail.com",
        phone: "+1 (408) 555-0789",
        linkedinUrl: "https://linkedin.com/in/elenarodriguez-devops",
        skills: ["Kubernetes", "Terraform", "CI/CD", "AWS", "Go"],
        experience: "8 years — Staff DevOps Engineer at Netflix",
        notes: "LinkedIn recruiter reach-out. Interested in leadership role.",
        source: "LinkedIn Recruiter",
      },
    ];
  }
}
