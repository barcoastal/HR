import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/breezy-pending-resumes?secret=...
 * Returns every candidate whose resumeUrl still points at the raw
 * api.breezy.hr endpoint — i.e. the ones whose resumes never got
 * downloaded because of the 403. The local scrape script uses this to
 * decide which candidates to fetch resumes for.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.candidate.findMany({
    where: { resumeUrl: { contains: "api.breezy.hr" } },
    select: { id: true, firstName: true, lastName: true, email: true, resumeUrl: true },
  });

  const candidates = rows.map((r) => {
    // resumeUrl shape:
    // https://api.breezy.hr/v3/company/{cid}/position/{pid}/candidate/{cnd}/resume
    const match = r.resumeUrl?.match(
      /api\.breezy\.hr\/v3\/company\/([^/]+)\/position\/([^/]+)\/candidate\/([^/]+)\/resume/
    );
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      email: r.email,
      resumeUrl: r.resumeUrl,
      breezyCompanyId: match?.[1] ?? null,
      breezyPositionId: match?.[2] ?? null,
      breezyCandidateId: match?.[3] ?? null,
    };
  });

  return NextResponse.json({ total: candidates.length, candidates });
}
