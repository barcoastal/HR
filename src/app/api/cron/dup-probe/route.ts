import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const first = url.searchParams.get("first") || "";
  const last = url.searchParams.get("last") || "";
  const rows = await db.candidate.findMany({
    where: {
      firstName: { equals: first, mode: "insensitive" },
      lastName: { equals: last, mode: "insensitive" },
    },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      source: true, status: true, createdAt: true, resumeUrl: true,
      applicationCount: true, positionId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ count: rows.length, rows });
}
