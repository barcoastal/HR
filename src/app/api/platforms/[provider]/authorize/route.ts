import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";
import { createOAuthState, getRequestBaseUrl } from "@/lib/oauth/utils";
import { db } from "@/lib/db";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-sync";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  // Public base URL — request.url's host is the container bind address on
  // Railway (0.0.0.0:8080), so it must come from forwarded headers.
  const baseUrl = getRequestBaseUrl(_request);

  // 1. Verify session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const url = new URL("/login", baseUrl);
    return NextResponse.redirect(url);
  }
  const userId = session.user.id;

  // 2. Look up provider config
  const provider = getOAuthProvider(providerId);
  if (!provider || !provider.isAvailable) {
    const url = new URL("/settings", baseUrl);
    url.searchParams.set("oauth_error", `Provider "${providerId}" is not available for OAuth`);
    return NextResponse.redirect(url);
  }

  // 3. Check if real OAuth credentials exist in env
  const creds = getOAuthCredentials(provider);

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

  // 4. Real OAuth — create state token in DB. The stored redirectUri must be
  // the exact value we send to the provider — the token exchange replays it.
  const url = new URL(_request.url);
  const mode = url.searchParams.get("mode");
  const metadata = mode ? { mode } : undefined;
  const redirectUri = `${baseUrl}/api/platforms/${providerId}/callback`;
  const state = await createOAuthState(providerId, userId, metadata, redirectUri);

  // 5. Build authorization URL and redirect to provider
  const authUrl = new URL(provider.authorizationUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", provider.scopes.join(" "));

  // Indeed requires prompt=select_employer so the user picks which employer account to authorize
  if (providerId === "indeed") {
    authUrl.searchParams.set("prompt", "select_employer");
  }

  // Google requires access_type=offline to get a refresh token, and
  // prompt=consent to force re-consent. select_account forces the account
  // chooser — without it Google silently reuses the last-used account, which
  // errors out when that account is outside the Workspace (e.g. a personal
  // Gmail when the OAuth app is Internal).
  if (providerId === "google_calendar") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent select_account");
  }

  return NextResponse.redirect(authUrl.toString());
}
