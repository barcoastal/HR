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
