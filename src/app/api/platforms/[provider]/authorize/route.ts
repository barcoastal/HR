import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";
import { createOAuthState, getCallbackUrl } from "@/lib/oauth/utils";
import { db } from "@/lib/db";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-sync";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

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
  const redirectUri = getCallbackUrl(providerId);
  const authUrl = new URL(provider.authorizationUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", provider.scopes.join(" "));

  return NextResponse.redirect(authUrl.toString());
}
