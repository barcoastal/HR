import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.candidate.findMany({
    where: { resumeUrl: { not: null } },
    select: { resumeUrl: true, createdAt: true },
  });
  const buckets: Record<string, { count: number; earliest: string; latest: string }> = {};
  for (const r of rows) {
    if (!r.resumeUrl) continue;
    let key = "other";
    if (r.resumeUrl.startsWith("/api/resumes/")) key = "/api/resumes/* (local)";
    else if (r.resumeUrl.includes("api.breezy.hr") && r.resumeUrl.includes("/resume")) key = "api.breezy.hr api endpoint";
    else if (r.resumeUrl.includes("breezy")) key = "breezy CDN/other";
    else if (r.resumeUrl.includes("amazonaws")) key = "S3 signed URL";
    else if (r.resumeUrl.includes("jobing")) key = "jobing.com";
    else key = `other (${new URL(r.resumeUrl, "https://x.invalid").hostname})`;
    const b = buckets[key] || { count: 0, earliest: r.createdAt.toISOString(), latest: r.createdAt.toISOString() };
    b.count += 1;
    if (r.createdAt.toISOString() < b.earliest) b.earliest = r.createdAt.toISOString();
    if (r.createdAt.toISOString() > b.latest) b.latest = r.createdAt.toISOString();
    buckets[key] = b;
  }
  return NextResponse.json({ total: rows.length, buckets });
}
