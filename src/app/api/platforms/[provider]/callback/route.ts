import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOAuthProvider } from "@/lib/oauth/config";
import {
  validateAndConsumeState,
  exchangeCodeForTokens,
  getBaseUrl,
} from "@/lib/oauth/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const url = new URL(request.url);
  const settingsUrl = new URL("/settings", getBaseUrl());

  // 1. Handle error from provider (user denied, etc.)
  const error = url.searchParams.get("error");
  if (error) {
    const errorDesc = url.searchParams.get("error_description") || error;
    settingsUrl.searchParams.set("oauth_error", errorDesc);
    return NextResponse.redirect(settingsUrl);
  }

  // 2. Validate code and state params
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    settingsUrl.searchParams.set("oauth_error", "Missing authorization code or state parameter");
    return NextResponse.redirect(settingsUrl);
  }

  // 3. Consume state token (CSRF check)
  const stateData = await validateAndConsumeState(state);
  if (!stateData) {
    settingsUrl.searchParams.set("oauth_error", "Invalid or expired OAuth state. Please try again.");
    return NextResponse.redirect(settingsUrl);
  }

  // Verify provider matches
  if (stateData.provider !== providerId) {
    settingsUrl.searchParams.set("oauth_error", "Provider mismatch in OAuth state");
    return NextResponse.redirect(settingsUrl);
  }

  // 4. Look up provider config
  const provider = getOAuthProvider(providerId);
  if (!provider) {
    settingsUrl.searchParams.set("oauth_error", `Unknown provider: ${providerId}`);
    return NextResponse.redirect(settingsUrl);
  }

  // 5. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(provider, code, stateData.redirectUri);
  if (!tokens) {
    settingsUrl.searchParams.set("oauth_error", "Failed to exchange authorization code for tokens");
    return NextResponse.redirect(settingsUrl);
  }

  // 6. Upsert RecruitmentPlatform with tokens
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await db.recruitmentPlatform.upsert({
    where: { name: provider.platformName },
    create: {
      name: provider.platformName,
      type: "PREMIUM",
      status: "ACTIVE",
      apiKey: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt,
      tokenScopes: tokens.scope ?? provider.scopes.join(" "),
      oauthProvider: providerId,
      connectedAt: new Date(),
    },
    update: {
      apiKey: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt,
      tokenScopes: tokens.scope ?? provider.scopes.join(" "),
      oauthProvider: providerId,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
  });

  // 7. Redirect to settings with success
  settingsUrl.searchParams.set("oauth_success", provider.platformName);
  return NextResponse.redirect(settingsUrl);
}
