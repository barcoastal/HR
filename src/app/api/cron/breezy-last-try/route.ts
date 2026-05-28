import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

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
  const target = `${BREEZY_BASE_URL}/company/${companyId}/position/${positionId}/candidate/${candidateId}/resume`;

  const variants = [
    { label: "POST + token", method: "POST", headers: { Authorization: token } },
    { label: "GET + Cookie token", method: "GET", headers: { Cookie: `accessToken=${token}; access_token=${token}` } },
    { label: "GET + X-Access-Token", method: "GET", headers: { "X-Access-Token": token } },
    { label: "GET + X-Auth-Token", method: "GET", headers: { "X-Auth-Token": token } },
    { label: "GET ?access_token", method: "GET", headers: {}, urlSuffix: `?access_token=${token}` },
    { label: "GET ?token", method: "GET", headers: {}, urlSuffix: `?token=${token}` },
    { label: "GET ?api_token", method: "GET", headers: {}, urlSuffix: `?api_token=${token}` },
    { label: "GET + Bearer space token", method: "GET", headers: { Authorization: `Bearer ${token}` } },
    { label: "GET + token=...", method: "GET", headers: { Authorization: `token=${token}` } },
  ] as { label: string; method: string; headers: Record<string, string>; urlSuffix?: string }[];

  type Result = { label: string; status: number; ct: string | null; bytes: number; body?: string };
  const out: Result[] = [];
  for (const v of variants) {
    try {
      const u = target + (v.urlSuffix || "");
      const res = await fetch(u, { method: v.method, headers: v.headers, redirect: "manual" });
      const buf = await res.arrayBuffer();
      const ct = res.headers.get("content-type");
      const body = buf.byteLength < 500 ? Buffer.from(buf).toString("utf-8") : `<${buf.byteLength} bytes binary>`;
      out.push({ label: v.label, status: res.status, ct, bytes: buf.byteLength, body });
    } catch (err) {
      out.push({ label: v.label, status: 0, ct: null, bytes: 0, body: String(err) });
    }
  }

  // Also try /v3/companies/{cid}/positions/{pid}/candidates/{cnd}/resume (plural)
  const plural = `${BREEZY_BASE_URL}/companies/${companyId}/positions/${positionId}/candidates/${candidateId}/resume`;
  let pluralResult: Result;
  try {
    const r = await fetch(plural, { headers: { Authorization: token } });
    const buf = await r.arrayBuffer();
    pluralResult = { label: "plural path", status: r.status, ct: r.headers.get("content-type"), bytes: buf.byteLength, body: buf.byteLength < 500 ? Buffer.from(buf).toString("utf-8") : `<${buf.byteLength} binary>` };
  } catch (e) {
    pluralResult = { label: "plural path", status: 0, ct: null, bytes: 0, body: String(e) };
  }
  out.push(pluralResult);

  return NextResponse.json({ target, variants: out });
}
