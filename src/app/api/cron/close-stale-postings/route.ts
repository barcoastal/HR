import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { breezySignIn, updateBreezyPositionState } from "@/lib/platform-sync/clients/breezy";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * GET /api/cron/close-stale-postings
 * Auth: `Authorization: Bearer $CRON_SECRET` (preferred) or `?secret=...`
 * Finds positions whose HR status is CLOSED/FILLED but still have a PUBLISHED
 * board posting and closes them on each board. Inlines Breezy auth so it
 * works without a user session.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stale = await db.position.findMany({
    where: {
      status: { in: ["CLOSED", "FILLED"] },
      boardPostings: { some: { status: "PUBLISHED" } },
    },
    select: {
      id: true,
      title: true,
      status: true,
      boardPostings: {
        where: { status: "PUBLISHED" },
        select: { board: true, externalId: true },
      },
    },
  });

  if (stale.length === 0) {
    return NextResponse.json({ ranAt: new Date().toISOString(), closed: [] });
  }

  // Pre-fetch Breezy credentials once (re-used for every posting)
  const breezyPlatform = await db.recruitmentPlatform.findUnique({ where: { name: "Breezy HR" } });
  let breezyToken: string | null = null;
  let breezyCompanyId: string | null = null;
  if (breezyPlatform?.refreshToken && breezyPlatform.accountIdentifier) {
    const decoded = Buffer.from(breezyPlatform.refreshToken, "base64").toString("utf-8");
    const [email, password] = decoded.split("::");
    const signin = await breezySignIn(email, password);
    breezyToken = signin.accessToken || null;
    breezyCompanyId = breezyPlatform.accountIdentifier;
  }

  const results: { positionId: string; title: string; board: string; ok: boolean; error?: string }[] = [];

  for (const p of stale) {
    for (const posting of p.boardPostings) {
      if (posting.board === "CAREERS") {
        await db.position.update({ where: { id: p.id }, data: { published: false } });
        results.push({ positionId: p.id, title: p.title, board: "CAREERS", ok: true });
        continue;
      }
      if (posting.board === "JOBING") {
        results.push({ positionId: p.id, title: p.title, board: "JOBING", ok: false, error: "Jobing API is read-only" });
        continue;
      }
      if (posting.board === "BREEZY") {
        if (!breezyToken || !breezyCompanyId || !posting.externalId) {
          results.push({ positionId: p.id, title: p.title, board: "BREEZY", ok: false, error: "Breezy not connected or no externalId" });
          continue;
        }
        const r = await updateBreezyPositionState({
          accessToken: breezyToken,
          companyId: breezyCompanyId,
          positionId: posting.externalId,
          state: "closed",
        });
        await db.positionBoardPosting.update({
          where: { positionId_board: { positionId: p.id, board: "BREEZY" } },
          data: r.success
            ? { status: "CLOSED", lastError: null }
            : { lastError: r.error || "Failed" },
        });
        results.push({ positionId: p.id, title: p.title, board: "BREEZY", ok: r.success, error: r.error });
      }
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), closed: results });
}
