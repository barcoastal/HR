import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/breezy-resume-hunt?secret=...
 * Aggressive probe — tries every plausible URL + header combo to find a way
 * to download a Breezy resume given the data the candidate detail provides.
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

  // Get the first candidate with a resume.
  const posRes = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/positions`, {
    headers: { Authorization: token },
  });
  const positions = posRes.ok ? ((await posRes.json()) as { _id: string }[]) : [];
  if (positions.length === 0) return NextResponse.json({ error: "no positions" });
  const pos = positions[0];

  const candsRes = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/position/${pos._id}/candidates`, {
    headers: { Authorization: token },
  });
  const cands = candsRes.ok ? ((await candsRes.json()) as { _id: string }[]) : [];
  if (cands.length === 0) return NextResponse.json({ error: "no candidates" });

  // Find the first candidate with a resume.
  let candId = "";
  let resume: { url?: string; file_name?: string; _id?: string } | null = null;
  for (const c of cands.slice(0, 5)) {
    const dr = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/position/${pos._id}/candidate/${c._id}`, {
      headers: { Authorization: token },
    });
    if (!dr.ok) continue;
    const detail = (await dr.json()) as { resume?: { url?: string; file_name?: string; _id?: string } };
    if (detail.resume?._id) {
      candId = c._id;
      resume = detail.resume;
      break;
    }
  }
  if (!resume) return NextResponse.json({ error: "no resume on first 5 candidates" });

  const fileName = resume.file_name || "";
  const fileBase = fileName.split("?")[0];
  const keyMatch = fileName.match(/[?&]key=([^&]+)/);
  const key = keyMatch ? keyMatch[1] : "";
  const resumeId = resume._id || "";

  const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
  const breezyHosts = ["https://api.breezy.hr", "https://app.breezy.hr", "https://files.breezy.hr"];

  type Probe = { label: string; method: string; url: string; headers: Record<string, string> };
  const probes: Probe[] = [];

  // The endpoint that's currently failing
  const apiResumeUrl = `${BREEZY_BASE_URL}/company/${companyId}/position/${pos._id}/candidate/${candId}/resume`;

  // 1. The api endpoint with various header shapes
  probes.push({ label: "api/resume + token", method: "GET", url: apiResumeUrl, headers: { Authorization: token } });
  probes.push({ label: "api/resume + token + accept-pdf", method: "GET", url: apiResumeUrl, headers: { Authorization: token, Accept: "application/pdf" } });
  probes.push({ label: "api/resume + token + UA", method: "GET", url: apiResumeUrl, headers: { Authorization: token, "User-Agent": browserUA } });
  probes.push({ label: "api/resume + token + ?key", method: "GET", url: `${apiResumeUrl}?key=${key}`, headers: { Authorization: token } });
  probes.push({ label: "api/resume ?key only", method: "GET", url: `${apiResumeUrl}?key=${key}`, headers: {} });

  // 2. Try the file_name on each potential host
  for (const host of breezyHosts) {
    probes.push({ label: `${host}/${fileBase}?key`, method: "GET", url: `${host}/${fileBase}?key=${key}`, headers: {} });
    probes.push({ label: `${host}/${fileBase}?key + UA`, method: "GET", url: `${host}/${fileBase}?key=${key}`, headers: { "User-Agent": browserUA } });
    probes.push({ label: `${host}/files/${fileBase}?key`, method: "GET", url: `${host}/files/${fileBase}?key=${key}`, headers: {} });
    probes.push({ label: `${host}/file/${fileBase}?key`, method: "GET", url: `${host}/file/${fileBase}?key=${key}`, headers: {} });
    probes.push({ label: `${host}/resume/${fileBase}?key`, method: "GET", url: `${host}/resume/${fileBase}?key=${key}`, headers: {} });
    probes.push({ label: `${host}/serve/${fileBase}?key`, method: "GET", url: `${host}/serve/${fileBase}?key=${key}`, headers: {} });
  }

  // 3. Try with the resume._id (no slashes)
  for (const host of breezyHosts) {
    probes.push({ label: `${host}/v3/files/${resumeId}`, method: "GET", url: `${host}/v3/files/${resumeId}`, headers: { Authorization: token } });
    probes.push({ label: `${host}/v3/resume/${resumeId}`, method: "GET", url: `${host}/v3/resume/${resumeId}`, headers: { Authorization: token } });
    probes.push({ label: `${host}/v3/file/${resumeId}?key`, method: "GET", url: `${host}/v3/file/${resumeId}?key=${key}`, headers: {} });
    probes.push({ label: `${host}/files/${resumeId}?key`, method: "GET", url: `${host}/files/${resumeId}?key=${key}`, headers: {} });
  }

  // 4. Follow redirects from the API resume endpoint
  probes.push({ label: "api/resume follow-redirect", method: "GET", url: apiResumeUrl, headers: { Authorization: token } });

  type Result = { label: string; status: number; contentType: string | null; bytes: number; isPdf: boolean; redirectedTo?: string; bodyPreview?: string; location?: string | null };
  const out: Result[] = [];
  for (const p of probes) {
    try {
      const useFollow = p.label === "api/resume follow-redirect";
      const res = await fetch(p.url, {
        method: p.method,
        headers: p.headers,
        redirect: useFollow ? "follow" : "manual",
      });
      const buf = await res.arrayBuffer();
      const ct = res.headers.get("content-type");
      // Detect a real PDF by its magic bytes %PDF (0x25 0x50 0x44 0x46).
      const head = new Uint8Array(buf.slice(0, 4));
      const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
      out.push({
        label: p.label,
        status: res.status,
        contentType: ct,
        bytes: buf.byteLength,
        isPdf,
        redirectedTo: useFollow ? res.url : undefined,
        bodyPreview: !isPdf && buf.byteLength < 500 ? Buffer.from(buf).toString("utf-8") : undefined,
        location: res.headers.get("location"),
      });
    } catch (err) {
      out.push({ label: p.label, status: 0, contentType: null, bytes: 0, isPdf: false, bodyPreview: String(err) });
    }
  }

  const winners = out.filter((r) => r.isPdf);
  return NextResponse.json({
    candidate: candId,
    resume,
    winners,
    allProbes: out,
  });
}
