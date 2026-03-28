import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const platform = await db.recruitmentPlatform.findUnique({
      where: { name: "Breezy HR" },
      select: {
        id: true,
        name: true,
        accountIdentifier: true,
        apiKey: true,
        refreshToken: true,
      },
    });

    if (!platform) {
      return NextResponse.json({
        status: "NOT_CONFIGURED",
        message: "Breezy HR platform not found in database",
      });
    }

    const hasAccountId = !!platform.accountIdentifier;
    const hasApiKey = !!platform.apiKey;
    const hasRefreshToken = !!platform.refreshToken;

    // Try to authenticate
    let authResult = null;
    if (hasRefreshToken && platform.refreshToken) {
      try {
        const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
        const [email, password] = decoded.split("::");
        if (email && password) {
          const { breezySignIn } = await import("@/lib/platform-sync/clients/breezy");
          const result = await breezySignIn(email, password);
          authResult = {
            success: !!result.accessToken,
            error: result.error || null,
            tokenLength: result.accessToken?.length || 0,
          };

          // If auth works, try listing positions with different auth formats
          if (result.accessToken && hasAccountId) {
            // Try 1: Plain token (current approach)
            const res1 = await fetch(
              `https://api.breezy.hr/v3/company/${platform.accountIdentifier}/positions?state=published`,
              { headers: { Authorization: result.accessToken } }
            );
            const body1 = await res1.text();

            // Try 2: Bearer prefix
            const res2 = await fetch(
              `https://api.breezy.hr/v3/company/${platform.accountIdentifier}/positions?state=published`,
              { headers: { Authorization: `Bearer ${result.accessToken}` } }
            );
            const body2 = await res2.text();

            // Try 3: Get user info to check permissions
            const res3 = await fetch(
              `https://api.breezy.hr/v3/user`,
              { headers: { Authorization: result.accessToken } }
            );
            const body3 = await res3.text();

            // Try 4: List companies
            const res4 = await fetch(
              `https://api.breezy.hr/v3/companies`,
              { headers: { Authorization: result.accessToken } }
            );
            const body4 = await res4.text();

            authResult = {
              ...authResult,
              plainToken: { status: res1.status, body: body1.slice(0, 300) },
              bearerToken: { status: res2.status, body: body2.slice(0, 300) },
              userInfo: { status: res3.status, body: body3.slice(0, 300) },
              companies: { status: res4.status, body: body4.slice(0, 300) },
            };
          }
        } else {
          authResult = { success: false, error: "Could not decode credentials" };
        }
      } catch (err) {
        authResult = {
          success: false,
          error: err instanceof Error ? err.message : "Auth error",
        };
      }
    }

    return NextResponse.json({
      status: "CONFIGURED",
      hasAccountId,
      hasApiKey,
      hasRefreshToken,
      accountIdentifier: platform.accountIdentifier?.slice(0, 8) + "...",
      authResult,
    });
  } catch (err) {
    return NextResponse.json({
      status: "ERROR",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
