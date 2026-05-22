import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/** GET /api/cron/bg-report-json?secret=...&reportKey=... — returns the full JSON report. Temp diagnostic. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reportKey = url.searchParams.get("reportKey");
  if (!reportKey) return NextResponse.json({ error: "pass ?reportKey=..." }, { status: 400 });

  const res = await fetch(
    `${BG_CHECK_BASE}/report/${reportKey}?api_token=${BG_CHECK_API_KEY}`,
    { headers: { Accept: "application/json" }, redirect: "manual" }
  );
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  return NextResponse.json({
    status: res.status,
    contentType: ct,
    body: ct.includes("json") ? JSON.parse(text) : text.slice(0, 1000),
  });
}
