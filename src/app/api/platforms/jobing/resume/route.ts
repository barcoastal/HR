import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const headers: HeadersInit = {};
    if (isJobing) {
      const apiKey = process.env.NOLIG_API_KEY || "";
      if (apiKey) headers["Authorization"] = `Bearer token=${apiKey}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}. Try opening the resume on the source platform.` },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

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
