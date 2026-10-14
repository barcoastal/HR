import { NextResponse } from "next/server";
import { runReviewMilestoneReminders } from "@/lib/review-reminders";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/review-reminders?secret=...
 * Call once a day (same external scheduler as /api/cron/anniversary-reviews).
 * Emails each manager a week before every unscheduled 30/60/90-day,
 * quarterly or yearly review of their reports, plus the configured
 * Review & 1:1 oversight recipients. Safe to call repeatedly.
 */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReviewMilestoneReminders();
  return NextResponse.json(result);
}
