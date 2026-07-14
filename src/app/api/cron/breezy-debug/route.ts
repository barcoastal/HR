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
    ? ((await posRes.json()) as {
        _id: string;
        name: string;
        state: string;
        location?: { name?: string; city?: string; country?: unknown; state?: unknown; is_remote?: boolean };
      }[])
    : [];

  const hrPositions = await db.position.findMany({ select: { id: true, title: true, status: true } });
  const links = await db.positionBoardPosting.findMany({
    where: { board: "BREEZY" },
    select: { positionId: true, externalId: true, status: true, titleOverride: true },
  });

  // ?view=positions — light snapshot of what Breezy actually stored per
  // position (location included) without the expensive candidate loop.
  if (url.searchParams.get("view") === "positions") {
    return NextResponse.json({
      breezyPositions: breezyPositions.map((p) => ({
        id: p._id,
        name: p.name,
        state: p.state,
        location: p.location ?? null,
      })),
      breezyLinks: links,
    });
  }

  // ?fix=locations — repair positions Breezy stored with no/malformed address
  // (created before country/state were sent as {id,name} objects). Uses the
  // linked HR position's location string when available, HQ default otherwise.
  if (url.searchParams.get("fix") === "locations") {
    const { buildBreezyLocation, updateBreezyPosition } = await import(
      "@/lib/platform-sync/clients/breezy"
    );
    const hrLocationByExternalId = new Map<string, string | undefined>();
    for (const link of links) {
      if (!link.externalId) continue;
      const hrPos = await db.position.findUnique({
        where: { id: link.positionId },
        select: { location: true },
      });
      hrLocationByExternalId.set(link.externalId, hrPos?.location ?? undefined);
    }

    const results: { id: string; name: string; before: unknown; sent: unknown; success: boolean; error?: string }[] = [];
    for (const p of breezyPositions) {
      const loc = p.location;
      const hasValidAddress =
        loc && typeof loc.country === "object" && loc.country !== null && !!loc.city;
      if (hasValidAddress) continue;
      const newLocation = buildBreezyLocation(hrLocationByExternalId.get(p._id));
      const r = await updateBreezyPosition({
        accessToken: token,
        companyId,
        positionId: p._id,
        fields: { name: p.name, location: newLocation },
      });
      results.push({
        id: p._id,
        name: p.name,
        before: loc ?? null,
        sent: newLocation,
        success: r.success,
        error: r.error,
      });
    }
    return NextResponse.json({ fixed: results });
  }

  // Live fetch from Breezy (per-position candidates) so we can see the actual
  // emails + originating position the next sync would process.
  const livePerPos: { positionId: string; positionName: string; candidates: { id: string; email?: string; name?: string; origin?: string; source?: string }[] }[] = [];
  for (const p of breezyPositions) {
    const res = await fetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`,
      { headers: { Authorization: token } }
    );
    const data = res.ok ? ((await res.json()) as { _id: string; name?: string; email_address?: string; origin?: string; source?: string }[]) : [];
    livePerPos.push({
      positionId: p._id,
      positionName: p.name,
      candidates: data.map((c) => ({ id: c._id, email: c.email_address, name: c.name, origin: c.origin, source: c.source })),
    });
  }

  // Show DB state for any candidate emails that Breezy currently returns
  const breezyEmails = livePerPos.flatMap((p) => p.candidates.map((c) => c.email).filter(Boolean) as string[]);
  const dbMatches = breezyEmails.length === 0 ? [] : await db.candidate.findMany({
    where: { email: { in: breezyEmails } },
    select: { id: true, email: true, source: true, positionId: true, jobAppliedTo: true, createdAt: true },
  });

  return NextResponse.json({
    breezyPositions: breezyPositions.map((p) => ({ id: p._id, name: p.name, state: p.state })),
    hrPositions,
    breezyLinks: links,
    livePerPos,
    dbMatches,
  });
}
