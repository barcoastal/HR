import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

// Allow-list of external hosts we'll proxy a resume from. Anything outside
// this list returns 400 (we don't want to be an open proxy).
const ALLOWED_HOSTS = [
  "jobing.com",
  "breezy.hr",
  "amazonaws.com",     // Breezy + most ATS providers store signed S3 URLs
  "indeed.com",
  "indeedmail.com",
  "rocketmail.com",
  "gmail.com",
  "googleusercontent.com",
  "google.com",
  "linkedin.com",
  "ziprecruiter.com",
  "ngrok.app",         // local testing
];

function isAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!isAllowed(parsed.hostname)) {
    return NextResponse.json(
      { error: `Resume host not allowed (${parsed.hostname}). Open the link directly.` },
      { status: 400 },
    );
  }

  try {
    const isJobing = parsed.hostname.endsWith("jobing.com");
    const isBreezy = parsed.hostname.endsWith("breezy.hr");

    async function getBreezyHeaders(forceRefresh = false): Promise<Record<string, string>> {
      const platform = await db.recruitmentPlatform.findFirst({
        where: { name: "Breezy HR" },
        select: { id: true },
      });
      if (!platform) return {};
      if (forceRefresh) {
        // Invalidate the cached token so ensureValidToken re-signs in.
        await db.recruitmentPlatform.update({
          where: { id: platform.id },
          data: { tokenExpiresAt: new Date(0) },
        });
      }
      const tokenResult = await ensureValidToken(platform.id);
      if (!tokenResult.valid || !tokenResult.accessToken) return {};
      const token = tokenResult.accessToken.split("::")[0];
      return token ? { Authorization: token } : {};
    }

    let headers: Record<string, string> = {};
    if (isJobing) {
      const apiKey = process.env.NOLIG_API_KEY || "";
      if (apiKey) headers["Authorization"] = `Bearer token=${apiKey}`;
    }
    if (isBreezy) {
      headers = await getBreezyHeaders();
      if (!headers["Authorization"]) {
        return NextResponse.json(
          { error: "Breezy is not connected on the server. Reconnect via Settings → Integrations." },
          { status: 502 },
        );
      }
    }

    let res = await fetch(url, { headers });

    // Breezy returns 401/403/400 missingAccessToken when the cached access
    // token is stale. Force a fresh sign-in and retry once before giving up.
    if (isBreezy && !res.ok && (res.status === 400 || res.status === 401 || res.status === 403)) {
      console.warn(`[resume] Breezy ${res.status} on first attempt — forcing token refresh and retrying`);
      const freshHeaders = await getBreezyHeaders(true);
      if (freshHeaders["Authorization"]) {
        res = await fetch(url, { headers: freshHeaders });
      }
    }

    // For Jobing, signed S3 URLs sometimes reject when Authorization is
    // attached. Retry once without auth.
    if (isJobing && !res.ok && (res.status === 400 || res.status === 403)) {
      console.warn(`[resume] retry without auth for jobing (first attempt: ${res.status})`);
      res = await fetch(url);
    }

    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => "");
      console.error(`[resume] upstream ${res.status} for ${url}: ${bodyPreview.slice(0, 200)}`);
      return NextResponse.json(
        {
          error: `Upstream returned ${res.status}. Try opening the resume on the source platform.`,
          source: url,
          host: parsed.hostname,
          upstreamPreview: bodyPreview.slice(0, 200) || null,
        },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    // Cache the resume locally so future views never need to hit the ATS
    // again. Look up the candidate whose resumeUrl matches the URL we just
    // proxied, persist the PDF to data/resumes/<id>.pdf, and rewrite the
    // candidate row to point at the local /api/resumes/<id> path. This is
    // the same layout the sync uses, so /api/resumes/<id> serves the file
    // straight from disk.
    if (
      (contentType.includes("pdf") || contentType.includes("octet-stream")) &&
      body.byteLength >= 100
    ) {
      try {
        const owner = await db.candidate.findFirst({
          where: { resumeUrl: url },
          select: { id: true },
        });
        if (owner) {
          await mkdir(RESUMES_DIR, { recursive: true });
          await writeFile(path.join(RESUMES_DIR, `${owner.id}.pdf`), Buffer.from(body));
          await db.candidate.update({
            where: { id: owner.id },
            data: { resumeUrl: `/api/resumes/${owner.id}` },
          });
        }
      } catch (cacheErr) {
        console.error("[resume] failed to cache locally:", cacheErr);
        // Still serve the live response — caching is a best-effort step.
      }
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        // Inline disposition so PDFs render in iframes / new tabs.
        "Content-Disposition": "inline; filename=resume.pdf",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
