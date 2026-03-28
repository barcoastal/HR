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

          // If auth works, try listing positions
          if (result.accessToken && hasAccountId) {
            const res = await fetch(
              `https://api.breezy.hr/v3/company/${platform.accountIdentifier}/positions?state=published`,
              { headers: { Authorization: result.accessToken } }
            );
            const body = await res.text();
            authResult = {
              ...authResult,
              listPositionsStatus: res.status,
              listPositionsBody: body.slice(0, 500),
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
