import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/breezy-resume-shape?secret=...
 * Dumps the raw `resume` field for the first candidate so we can see every
 * URL/field Breezy returns for it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
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
  const positions = posRes.ok ? ((await posRes.json()) as { _id: string }[]) : [];

  type C = { _id: string; resume?: { url?: string; file_name?: string; _id?: string }; [k: string]: unknown };
  const candsRes = await fetch(
    `${BREEZY_BASE_URL}/company/${companyId}/position/${positions[0]._id}/candidates`,
    { headers: { Authorization: token } }
  );
  const cands = candsRes.ok ? ((await candsRes.json()) as C[]) : [];
  const first = cands[0];
  if (!first) return NextResponse.json({ error: "No candidates" }, { status: 404 });
  const detailRes = await fetch(
    `${BREEZY_BASE_URL}/company/${companyId}/position/${positions[0]._id}/candidate/${first._id}`,
    { headers: { Authorization: token } }
  );
  const detail = detailRes.ok ? ((await detailRes.json()) as C) : null;
  const r = detail?.resume;
  if (!r) return NextResponse.json({ error: "No resume on first candidate" });

  const resumeId = r._id;
  const fileName = r.file_name; // contains "?key=<uuid>"
  const keyMatch = (fileName ?? "").match(/[?&]key=([^&]+)/);
  const key = keyMatch ? keyMatch[1] : null;
  const fileBase = (fileName ?? "").split("?")[0];

  const probes: { name: string; url: string; init: RequestInit }[] = [];
  if (resumeId) {
    probes.push({ name: "/v3/resume/{id}", url: `${BREEZY_BASE_URL}/resume/${resumeId}`, init: { headers: { Authorization: token } } });
    probes.push({ name: "/v3/files/{id}", url: `${BREEZY_BASE_URL}/files/${resumeId}`, init: { headers: { Authorization: token } } });
    probes.push({ name: "/v3/company/{co}/file/{id}", url: `${BREEZY_BASE_URL}/company/${companyId}/file/${resumeId}`, init: { headers: { Authorization: token } } });
  }
  if (key && fileBase) {
    probes.push({ name: "files.breezy.hr/?key=", url: `https://files.breezy.hr/${fileBase}?key=${key}`, init: {} });
    probes.push({ name: "app.breezy.hr/serve?key=", url: `https://app.breezy.hr/serve/${fileBase}?key=${key}`, init: {} });
    probes.push({ name: "candidates-cdn?key=", url: `https://breezy-uploads.s3.amazonaws.com/${fileBase}?key=${key}`, init: {} });
    probes.push({ name: "/v3/.../resume?key=", url: `${BREEZY_BASE_URL}/company/${companyId}/position/${positions[0]._id}/candidate/${first._id}/resume?key=${key}`, init: { headers: { Authorization: token } } });
    probes.push({ name: "/v3/.../resume?key= (no auth)", url: `${BREEZY_BASE_URL}/company/${companyId}/position/${positions[0]._id}/candidate/${first._id}/resume?key=${key}`, init: {} });
    probes.push({ name: "/v3/.../resume (follow redirect)", url: `${BREEZY_BASE_URL}/company/${companyId}/position/${positions[0]._id}/candidate/${first._id}/resume`, init: { headers: { Authorization: token }, redirect: "follow" } });
  }

  type Result = { name: string; url: string; status: number; contentType: string | null; bytes: number; location: string | null; body?: string };
  const out: Result[] = [];
  for (const p of probes) {
    try {
      const res = await fetch(p.url, { ...p.init, redirect: (p.init as { redirect?: RequestRedirect }).redirect ?? "manual" });
      const buf = await res.arrayBuffer();
      out.push({
        name: p.name,
        url: p.url,
        status: res.status,
        contentType: res.headers.get("content-type"),
        bytes: buf.byteLength,
        location: res.headers.get("location"),
        body: buf.byteLength < 400 ? Buffer.from(buf).toString("utf-8") : undefined,
      });
    } catch (err) {
      out.push({ name: p.name, url: p.url, status: 0, contentType: null, bytes: 0, location: null, body: String(err) });
    }
  }

  return NextResponse.json({ rawResume: r, probes: out });
}
