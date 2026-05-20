import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/audit-search?secret=...&email=foo@bar.com
 * Look up audit rows for a candidate by email (or candidateId).
 * Temp diagnostic — secret-gated.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = url.searchParams.get("email");
  const candidateId = url.searchParams.get("candidateId");
  if (!email && !candidateId) {
    return NextResponse.json({ error: "pass ?email= or ?candidateId=" }, { status: 400 });
  }

  let resolvedId = candidateId;
  let candidate: { id: string; firstName: string; lastName: string; email: string; status: string } | null = null;
  if (email) {
    candidate = await db.candidate.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    });
    if (candidate) resolvedId = candidate.id;
  }

  const where: Record<string, unknown> = { entityType: "candidate" };
  if (resolvedId) where.entityId = resolvedId;

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ candidate, count: rows.length, rows });
}
