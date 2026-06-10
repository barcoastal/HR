import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/cron/worker-heartbeat?secret=...
 * Body: { name, uploaded, failed, pending }
 *
 * Background workers post here at the end of every tick so the watchdog can
 * detect silent death — if `lastTickAt` goes stale by more than 15 min, the
 * watchdog notifies + restarts the service.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : null;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  await db.workerHeartbeat.upsert({
    where: { name },
    update: {
      lastTickAt: new Date(),
      lastUploaded: typeof body.uploaded === "number" ? body.uploaded : 0,
      lastFailed: typeof body.failed === "number" ? body.failed : 0,
      pendingCount: typeof body.pending === "number" ? body.pending : 0,
    },
    create: {
      name,
      lastUploaded: typeof body.uploaded === "number" ? body.uploaded : 0,
      lastFailed: typeof body.failed === "number" ? body.failed : 0,
      pendingCount: typeof body.pending === "number" ? body.pending : 0,
    },
  });

  return NextResponse.json({ ok: true });
}
