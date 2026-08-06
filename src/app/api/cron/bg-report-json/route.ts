import { NextResponse } from "next/server";
import { getOrder, isContinentalConfigured } from "@/lib/continental";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/bg-report-json?secret=...&orderId=...
 *
 * Diagnostic: returns the raw Continental order payload (status + searches)
 * for a given OrderID so we can inspect what the provider reports without
 * touching the database.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isContinentalConfigured()) {
    return NextResponse.json({ error: "Continental credentials not configured" }, { status: 500 });
  }

  const orderId = url.searchParams.get("orderId") || url.searchParams.get("reportKey");
  if (!orderId) return NextResponse.json({ error: "pass ?orderId=..." }, { status: 400 });

  try {
    const order = await getOrder(orderId);
    return NextResponse.json({ order });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
