export type OAuthProviderConfig = {
  providerId: string;
  platformName: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  isAvailable: boolean;
};

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  linkedin: {
    providerId: "linkedin",
    platformName: "LinkedIn Recruiter",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email"],
    clientIdEnvVar: "LINKEDIN_CLIENT_ID",
    clientSecretEnvVar: "LINKEDIN_CLIENT_SECRET",
    isAvailable: true,
  },
  indeed: {
    providerId: "indeed",
    platformName: "Indeed",
    authorizationUrl: "https://secure.indeed.com/oauth/v2/authorize",
    tokenUrl: "https://apis.indeed.com/oauth/v2/tokens",
    scopes: ["email", "offline_access", "employer_access"],
    clientIdEnvVar: "INDEED_CLIENT_ID",
    clientSecretEnvVar: "INDEED_CLIENT_SECRET",
    isAvailable: true,
  },
  handshake: {
    providerId: "handshake",
    platformName: "Handshake",
    authorizationUrl: "",
    tokenUrl: "",
    scopes: [],
    clientIdEnvVar: "",
    clientSecretEnvVar: "",
    isAvailable: false,
  },
  employfl: {
    providerId: "employfl",
    platformName: "EmployFL",
    authorizationUrl: "",
    tokenUrl: "",
    scopes: [],
    clientIdEnvVar: "",
    clientSecretEnvVar: "",
    isAvailable: false,
  },
  google_calendar: {
    providerId: "google_calendar",
    platformName: "Google Calendar",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    clientIdEnvVar: "GOOGLE_CALENDAR_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CALENDAR_CLIENT_SECRET",
    isAvailable: true,
  },
};

export function getOAuthProvider(id: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[id] ?? null;
}

export function getOAuthCredentials(provider: OAuthProviderConfig): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env[provider.clientIdEnvVar];
  const clientSecret = process.env[provider.clientSecretEnvVar];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
