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

  type C = { _id: string; resume?: unknown; [k: string]: unknown };
  const dump: { positionId: string; candidates: { _id: string; rawResumeField: unknown; keys: string[] }[] }[] = [];
  for (const p of positions.slice(0, 1)) {
    const candsRes = await fetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`,
      { headers: { Authorization: token } }
    );
    const cands = candsRes.ok ? ((await candsRes.json()) as C[]) : [];
    const dumped: { _id: string; rawResumeField: unknown; keys: string[] }[] = [];
    for (const c of cands.slice(0, 2)) {
      const detailRes = await fetch(
        `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidate/${c._id}`,
        { headers: { Authorization: token } }
      );
      const detail = detailRes.ok ? ((await detailRes.json()) as C) : null;
      dumped.push({
        _id: c._id,
        rawResumeField: detail?.resume ?? null,
        keys: detail ? Object.keys(detail) : [],
      });
    }
    dump.push({ positionId: p._id, candidates: dumped });
  }

  return NextResponse.json(dump);
}
