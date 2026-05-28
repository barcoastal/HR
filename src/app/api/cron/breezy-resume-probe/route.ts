import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/breezy-resume-probe?secret=...&candidate=20111d52152f01&position=e1864a437bff01
 * Tries the Breezy resume endpoint with several auth header variants so we
 * can see which one Breezy actually accepts. Temp diagnostic.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const candidateId = url.searchParams.get("candidate");
  const positionId = url.searchParams.get("position");
  if (!candidateId || !positionId) {
    return NextResponse.json({ error: "Pass ?candidate=...&position=..." }, { status: 400 });
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
  const resumeUrl = `https://api.breezy.hr/v3/company/${companyId}/position/${positionId}/candidate/${candidateId}/resume`;
  const candidateUrl = `https://api.breezy.hr/v3/company/${companyId}/position/${positionId}/candidate/${candidateId}`;

  const variants = [
    { label: "plain", headers: { Authorization: token } },
    { label: "Bearer", headers: { Authorization: `Bearer ${token}` } },
    { label: "Token", headers: { Authorization: `Token ${token}` } },
    { label: "X-Access-Token", headers: { "X-Access-Token": token } },
    { label: "no-auth", headers: {} },
  ];

  type Result = { label: string; status: number; contentType: string | null; bodyPreview: string; location?: string | null };
  const out: Result[] = [];
  for (const v of variants) {
    try {
      const r = await fetch(resumeUrl, { headers: v.headers, redirect: "manual" });
      const ct = r.headers.get("content-type") || "";
      const text = await r.text().catch(() => "");
      out.push({
        label: v.label,
        status: r.status,
        contentType: ct,
        bodyPreview: text.slice(0, 250),
        location: r.headers.get("location"),
      });
    } catch (err) {
      out.push({ label: v.label, status: 0, contentType: null, bodyPreview: String(err) });
    }
  }

  // Also fetch the candidate detail to see what resume.pdf_url Breezy expects us to use
  let candidateDetail: unknown = null;
  try {
    const r = await fetch(candidateUrl, { headers: { Authorization: token } });
    const t = await r.text();
    candidateDetail = r.ok ? JSON.parse(t) : { status: r.status, body: t.slice(0, 300) };
  } catch (err) {
    candidateDetail = { error: String(err) };
  }

  return NextResponse.json({
    resumeUrl,
    candidateUrl,
    tokenLen: token.length,
    companyId,
    probes: out,
    candidateDetailResumeField:
      candidateDetail && typeof candidateDetail === "object" && "resume" in candidateDetail
        ? (candidateDetail as { resume?: unknown }).resume
        : "no candidate detail",
  });
}
