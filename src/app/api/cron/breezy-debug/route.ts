import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/** GET /api/cron/breezy-debug?secret=... — diagnostic snapshot to find position-link gaps. */
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
  const breezyPositions = posRes.ok
    ? ((await posRes.json()) as { _id: string; name: string; state: string }[])
    : [];

  const hrPositions = await db.position.findMany({ select: { id: true, title: true, status: true } });
  const links = await db.positionBoardPosting.findMany({
    where: { board: "BREEZY" },
    select: { positionId: true, externalId: true, status: true, titleOverride: true },
  });

  const recentCandidates = await db.candidate.findMany({
    where: { source: { in: ["Breezy HR", "Indeed", "LinkedIn"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, email: true, source: true, positionId: true, jobAppliedTo: true },
  });

  return NextResponse.json({
    breezyPositions: breezyPositions.map((p) => ({ id: p._id, name: p.name, state: p.state })),
    hrPositions,
    breezyLinks: links,
    recentCandidates,
  });
}
