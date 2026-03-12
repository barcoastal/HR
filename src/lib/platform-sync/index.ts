import type { PlatformClient } from "./types";
import { LinkedInRecruiterClient } from "./clients/linkedin";
import { IndeedClient } from "./clients/indeed";
import { HandshakeClient } from "./clients/handshake";
import { EmployFLClient } from "./clients/employfl";
import { JobingClient } from "./clients/jobing";

const CLIENT_REGISTRY: Record<string, () => PlatformClient> = {
  "LinkedIn Recruiter": () => new LinkedInRecruiterClient(),
  Indeed: () => new IndeedClient(),
  Handshake: () => new HandshakeClient(),
  EmployFL: () => new EmployFLClient(),
  Jobing: () => new JobingClient(),
};

export function getPlatformClient(platformName: string): PlatformClient | null {
  const factory = CLIENT_REGISTRY[platformName];
  return factory ? factory() : null;
}

export function hasSyncSupport(platformName: string): boolean {
  return platformName in CLIENT_REGISTRY;
}

export const SUPPORTED_PLATFORMS = [
  {
    name: "LinkedIn Recruiter",
    description: "Import senior candidates from LinkedIn's recruiter pipeline",
    type: "PREMIUM" as const,
    monthlyCost: 825,
    keyPrefix: "li-",
    color: "bg-blue-600",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    permissions: ["Access your recruiter seat", "View candidate profiles", "Export candidate data"],
    oauthProviderId: "linkedin",
    hasRealOAuth: true,
  },
  {
    name: "Indeed",
    description: "Sync candidates from Indeed job postings and resume database",
    type: "PREMIUM" as const,
    monthlyCost: 300,
    keyPrefix: "indeed-",
    color: "bg-[#2164f3]",
    textColor: "text-[#2164f3]",
    bgLight: "bg-indigo-50",
    permissions: ["Access your employer account", "View applicant data", "Read resume database"],
    oauthProviderId: "indeed",
    hasRealOAuth: true,
  },
  {
    name: "Handshake",
    description: "Connect with college students and recent graduates",
    type: "NICHE" as const,
    monthlyCost: 150,
    keyPrefix: "hs-",
    color: "bg-[#e4533d]",
    textColor: "text-[#e4533d]",
    bgLight: "bg-red-50",
    permissions: ["Access employer portal", "View student profiles", "Sync applicants"],
    oauthProviderId: "handshake",
    hasRealOAuth: false,
  },
  {
    name: "EmployFL",
    description: "Florida-based talent pool with bilingual candidates",
    type: "NICHE" as const,
    monthlyCost: 0,
    keyPrefix: "efl-",
    color: "bg-emerald-600",
    textColor: "text-emerald-600",
    bgLight: "bg-emerald-50",
    permissions: ["Access employer account", "View candidate pool", "Export candidate data"],
    oauthProviderId: "employfl",
    hasRealOAuth: false,
  },
  {
    name: "Jobing",
    description: "Import applicants from Jobing/NOLIG job board",
    type: "JOB_BOARD" as const,
    monthlyCost: 0,
    keyPrefix: "jobing-",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    bgLight: "bg-orange-50",
    permissions: ["Access applicant data", "View job listings", "Download resumes"],
    oauthProviderId: "jobing",
    hasRealOAuth: false,
  },
  {
    name: "Google Calendar",
    description: "Schedule interviews with automatic Google Meet links",
    type: "PREMIUM" as const,
    monthlyCost: 0,
    keyPrefix: "gcal-",
    color: "bg-[#4285f4]",
    textColor: "text-[#4285f4]",
    bgLight: "bg-blue-50",
    permissions: ["Create calendar events", "Generate Google Meet links", "Send calendar invites"],
    oauthProviderId: "google_calendar",
    hasRealOAuth: true,
  },
];
