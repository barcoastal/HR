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

  for (const p of positions) {
    const candsRes = await fetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`,
      { headers: { Authorization: token } }
    );
    const cands = candsRes.ok ? ((await candsRes.json()) as { _id: string }[]) : [];
    if (cands.length === 0) continue;

    const first = cands[0];
    const detailRes = await fetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidate/${first._id}`,
      { headers: { Authorization: token } }
    );
    const detail = detailRes.ok ? await detailRes.json() : { httpStatus: detailRes.status };
    return NextResponse.json({
      position: { id: p._id, name: p.name },
      candidateId: first._id,
      detail,
    });
  }

  return NextResponse.json({ note: "No candidates found across any positions" });
}
