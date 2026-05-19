import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/breezy-detail-debug?secret=...
 * Pulls one Breezy position's first candidate and returns the raw detail
 * payload so we can see the exact shape of the resume field. Remove after
 * diagnosis.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = await db.recruitmentPlatform.findFirst({ where: { name: "Breezy HR" } });
  if (!platform) return NextResponse.json({ error: "Breezy not connected" }, { status: 404 });
  const tokenResult = await ensureValidToken(platform.id);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    return NextResponse.json({ error: tokenResult.error || "No token" }, { status: 500 });
  }
  const [token, companyId] = tokenResult.accessToken.split("::");

  const posRes = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/positions`, {
    headers: { Authorization: token },
  });
  const positions = posRes.ok ? ((await posRes.json()) as { _id: string; name: string }[]) : [];

  type Cand = { _id: string; email_address?: string; resume?: { url?: string; pdf_url?: string; file_name?: string } };
  const samples: { position: string; candidateEmail?: string; resumeFromBreezy?: string; resumeInDb?: string | null; matchesLocalPattern?: boolean; testDownload?: { status: number; contentType: string | null; bytes: number } }[] = [];

  outer: for (const p of positions) {
    const candsRes = await fetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`,
      { headers: { Authorization: token } }
    );
    const cands = candsRes.ok ? ((await candsRes.json()) as Cand[]) : [];
    for (const c of cands.slice(0, 3)) {
      const detailRes = await fetch(
        `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidate/${c._id}`,
        { headers: { Authorization: token } }
      );
      const detail = detailRes.ok ? ((await detailRes.json()) as Cand) : null;
      const resumeUrl = detail?.resume?.pdf_url || detail?.resume?.url;
      const dbCand = detail?.email_address
        ? await db.candidate.findUnique({
            where: { email: detail.email_address },
            select: { id: true, resumeUrl: true },
          })
        : null;

      // Probe multiple auth shapes against the resume URL to find what works.
      const probes: { name: string; init: RequestInit; url: string }[] = [];
      if (resumeUrl) {
        probes.push({ name: "raw-token", url: resumeUrl, init: { headers: { Authorization: token } } });
        probes.push({ name: "bearer-token", url: resumeUrl, init: { headers: { Authorization: `Bearer ${token}` } } });
        probes.push({ name: "no-auth", url: resumeUrl, init: {} });
        probes.push({ name: "no-redirect", url: resumeUrl, init: { headers: { Authorization: token }, redirect: "manual" } });
        const fileName = detail?.resume?.file_name;
        if (fileName) {
          probes.push({ name: "files-host", url: `https://files.breezy.hr/${fileName}`, init: {} });
          probes.push({ name: "app-files", url: `https://app.breezy.hr/files/${fileName}`, init: {} });
        }
      }
      type Probe = { name: string; url: string; status: number; contentType: string | null; bytes: number; location: string | null; body?: string };
      const probeResults: Probe[] = [];
      for (const p of probes) {
        try {
          const r = await fetch(p.url, p.init);
          const buf = await r.arrayBuffer();
          probeResults.push({
            name: p.name,
            url: p.url,
            status: r.status,
            contentType: r.headers.get("content-type"),
            bytes: buf.byteLength,
            location: r.headers.get("location"),
            body: buf.byteLength < 500 ? Buffer.from(buf).toString("utf-8") : undefined,
          });
        } catch (err) {
          probeResults.push({ name: p.name, url: p.url, status: 0, contentType: null, bytes: 0, location: null, body: String(err) });
        }
      }
      const testDownload = probeResults[0];

      samples.push({
        position: p.name,
        candidateEmail: detail?.email_address,
        resumeFromBreezy: resumeUrl,
        resumeFileName: detail?.resume?.file_name,
        resumeInDb: dbCand?.resumeUrl ?? null,
        matchesLocalPattern: dbCand?.resumeUrl?.startsWith("/api/resumes/") ?? false,
        testDownload,
        probes: probeResults,
      } as unknown as typeof samples[number]);
      if (samples.length >= 2) break outer;
    }
  }

  return NextResponse.json({ samples });
}
