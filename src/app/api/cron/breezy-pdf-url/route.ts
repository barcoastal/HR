import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/breezy-pdf-url?secret=...
 * Breezy's docs say `resume.pdf_url` should exist on the candidate detail,
 * but we're only getting `url`, `file_name`, `_id`. Try query-param variants
 * + alternate endpoints to coax `pdf_url` out, and follow it if found.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const platform = await db.recruitmentPlatform.findFirst({ where: { name: "Breezy HR" } });
  if (!platform) return NextResponse.json({ error: "Breezy not connected" }, { status: 404 });
  await db.recruitmentPlatform.update({
    where: { id: platform.id },
    data: { tokenExpiresAt: new Date(0) },
  });
  const tokenResult = await ensureValidToken(platform.id);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    return NextResponse.json({ error: tokenResult.error || "No token" }, { status: 500 });
  }
  const [token, companyId] = tokenResult.accessToken.split("::");
  const positionId = "e1864a437bff01";
  const candidateId = "20111d52152f01";

  const base = `${BREEZY_BASE_URL}/company/${companyId}/position/${positionId}/candidate/${candidateId}`;

  type Probe = { label: string; url: string; method?: string; headers?: Record<string, string> };
  const probes: Probe[] = [
    { label: "plain candidate detail", url: base },
    { label: "?expand=resume", url: `${base}?expand=resume` },
    { label: "?include=resume", url: `${base}?include=resume` },
    { label: "?include=resume.pdf_url", url: `${base}?include=resume.pdf_url` },
    { label: "?fields=resume", url: `${base}?fields=resume` },
    { label: "?embed=resume", url: `${base}?embed=resume` },
    { label: "?with_resume=true", url: `${base}?with_resume=true` },
    { label: "?pdf_url=true", url: `${base}?pdf_url=true` },
    { label: "?resume_url=true", url: `${base}?resume_url=true` },
    // Sometimes APIs return more fields when Accept is set
    { label: "Accept: application/json+full", url: base, headers: { Accept: "application/json; full" } },
    { label: "Accept-Version: v3.1", url: base, headers: { "Accept-Version": "v3.1" } },
    // Try alternate paths in case there's an undocumented "full" variant
    { label: "/full path", url: `${base}/full` },
    { label: "/details path", url: `${base}/details` },
    { label: "/profile path", url: `${base}/profile` },
  ];

  const out: { label: string; status: number; resumeKeys: string[]; resume: unknown; rawKeys?: string[] }[] = [];
  for (const p of probes) {
    try {
      const res = await fetch(p.url, {
        method: p.method ?? "GET",
        headers: { Authorization: token, ...(p.headers ?? {}) },
      });
      const text = await res.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { /* not json */ }
      const obj = parsed as { resume?: unknown } | null;
      const resume = obj?.resume ?? null;
      out.push({
        label: p.label,
        status: res.status,
        resumeKeys: resume && typeof resume === "object" ? Object.keys(resume as object) : [],
        resume,
        rawKeys: obj && typeof obj === "object" ? Object.keys(obj as object) : undefined,
      });
    } catch (err) {
      out.push({ label: p.label, status: 0, resumeKeys: [], resume: String(err) });
    }
  }

  return NextResponse.json({ candidateId, probes: out });
}
