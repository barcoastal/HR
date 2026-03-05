import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";
import { createOAuthState } from "@/lib/oauth/utils";
import { db } from "@/lib/db";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-sync";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  // Derive base URL from the actual request so it works on any domain
  const requestUrl = new URL(_request.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

  // 1. Verify session (use mock admin fallback)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? "mock-admin";

  // 2. Look up provider config
  const provider = getOAuthProvider(providerId);
  if (!provider || !provider.isAvailable) {
    const url = new URL("/settings", baseUrl);
    url.searchParams.set("oauth_error", `Provider "${providerId}" is not available for OAuth`);
    return NextResponse.redirect(url);
  }

  // 3. Check if real OAuth credentials exist in env
  const creds = getOAuthCredentials(provider);

  // Indeed: use client credentials flow directly (no redirect URI needed)
  if (providerId === "indeed" && creds) {
    try {
      const tokenRes = await fetch("https://apis.indeed.com/oauth/v2/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "employer_access",
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        const url = new URL("/settings", baseUrl);
        url.searchParams.set("oauth_error", `Indeed token error: ${errText.slice(0, 100)}`);
        return NextResponse.redirect(url);
      }

      const tokens = await tokenRes.json();

      const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

      await db.recruitmentPlatform.upsert({
        where: { name: provider.platformName },
        create: {
          name: provider.platformName,
          type: "PREMIUM",
          monthlyCost: 300,
          status: "ACTIVE",
          apiKey: tokens.access_token,
          refreshToken: null,
          tokenExpiresAt,
          tokenScopes: tokens.scope ?? "employer_access",
          oauthProvider: providerId,
          connectedAt: new Date(),
        },
        update: {
          apiKey: tokens.access_token,
          refreshToken: null,
          tokenExpiresAt,
          tokenScopes: tokens.scope ?? "employer_access",
          oauthProvider: providerId,
          status: "ACTIVE",
          connectedAt: new Date(),
        },
      });

      const url = new URL("/settings", baseUrl);
      url.searchParams.set("oauth_success", provider.platformName);
      return NextResponse.redirect(url);
    } catch (err) {
      const url = new URL("/settings", baseUrl);
      url.searchParams.set("oauth_error", `Indeed connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      return NextResponse.redirect(url);
    }
  }

  if (!creds) {
    // No real credentials — fall back to simulated connection
    const platformConfig = SUPPORTED_PLATFORMS.find(
      (p) => p.oauthProviderId === providerId
    );
    if (!platformConfig) {
      const url = new URL("/settings", baseUrl);
      url.searchParams.set("oauth_error", `Unknown platform for provider "${providerId}"`);
      return NextResponse.redirect(url);
    }

    const token = `${platformConfig.keyPrefix}oauth-${crypto.randomUUID().slice(0, 12)}`;

    await db.recruitmentPlatform.upsert({
      where: { name: provider.platformName },
      create: {
        name: provider.platformName,
        type: platformConfig.type,
        monthlyCost: platformConfig.monthlyCost,
        status: "ACTIVE",
        apiKey: token,
        connectedAt: new Date(),
      },
      update: {
        apiKey: token,
        status: "ACTIVE",
        connectedAt: new Date(),
      },
    });

    const url = new URL("/settings", baseUrl);
    url.searchParams.set("oauth_success", provider.platformName);
    return NextResponse.redirect(url);
  }

  // 4. Real OAuth — create state token in DB
  const state = await createOAuthState(providerId, userId);

  // 5. Build authorization URL and redirect to provider
  const redirectUri = `${baseUrl}/api/platforms/${providerId}/callback`;
  const authUrl = new URL(provider.authorizationUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", provider.scopes.join(" "));

  return NextResponse.redirect(authUrl.toString());
}
