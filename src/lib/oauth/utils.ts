import crypto from "crypto";
import { db } from "@/lib/db";
import type { OAuthProviderConfig } from "./config";
import { getOAuthCredentials } from "./config";

export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN)
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return "http://localhost:3000";
}

export function getCallbackUrl(providerId: string): string {
  return `${getBaseUrl()}/api/platforms/${providerId}/callback`;
}

export async function createOAuthState(
  providerId: string,
  userId: string
): Promise<string> {
  const state = generateState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.oAuthState.create({
    data: {
      state,
      provider: providerId,
      userId,
      redirectUri: getCallbackUrl(providerId),
      expiresAt,
    },
  });

  return state;
}

export async function validateAndConsumeState(
  state: string
): Promise<{ provider: string; userId: string; redirectUri: string } | null> {
  const record = await db.oAuthState.findUnique({ where: { state } });
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await db.oAuthState.delete({ where: { id: record.id } });
    return null;
  }

  // One-time use: delete after validation
  await db.oAuthState.delete({ where: { id: record.id } });

  return {
    provider: record.provider,
    userId: record.userId,
    redirectUri: record.redirectUri,
  };
}

export async function exchangeCodeForTokens(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
} | null> {
  const creds = getOAuthCredentials(provider);
  if (!creds) return null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function refreshAccessToken(
  provider: OAuthProviderConfig,
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const creds = getOAuthCredentials(provider);
  if (!creds) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function cleanupExpiredStates(): Promise<number> {
  const result = await db.oAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
