import type { PlatformClient } from "./types";
import { LinkedInRecruiterClient } from "./clients/linkedin";
import { IndeedClient } from "./clients/indeed";
import { HandshakeClient } from "./clients/handshake";
import { EmployFLClient } from "./clients/employfl";

const CLIENT_REGISTRY: Record<string, () => PlatformClient> = {
  "LinkedIn Recruiter": () => new LinkedInRecruiterClient(),
  Indeed: () => new IndeedClient(),
  Handshake: () => new HandshakeClient(),
  EmployFL: () => new EmployFLClient(),
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
    keyPlaceholder: "li-xxxxxxxxxxxxxxxx",
    keyHint: "Your LinkedIn Recruiter Seat API key (starts with li-)",
    color: "bg-blue-500",
  },
  {
    name: "Indeed",
    description: "Sync candidates from Indeed job postings and resume database",
    type: "PREMIUM" as const,
    monthlyCost: 300,
    keyPrefix: "indeed-",
    keyPlaceholder: "indeed-xxxxxxxxxxxxxxxx",
    keyHint: "Your Indeed Publisher API key (starts with indeed-)",
    color: "bg-purple-500",
  },
  {
    name: "Handshake",
    description: "Connect with college students and recent graduates",
    type: "NICHE" as const,
    monthlyCost: 150,
    keyPrefix: "hs-",
    keyPlaceholder: "hs-xxxxxxxxxxxxxxxx",
    keyHint: "Your Handshake employer OAuth token (starts with hs-)",
    color: "bg-amber-500",
  },
  {
    name: "EmployFL",
    description: "Florida-based talent pool with bilingual candidates",
    type: "NICHE" as const,
    monthlyCost: 0,
    keyPrefix: "efl-",
    keyPlaceholder: "efl-xxxxxxxxxxxxxxxx",
    keyHint: "Your EmployFL employer portal access key (starts with efl-)",
    color: "bg-emerald-500",
  },
];
