import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filename = url.searchParams.get("filename");
  if (!filename) return NextResponse.json({ error: "pass ?filename=" }, { status: 400 });

  const blob = await db.fileBlob.findUnique({
    where: { filename },
    select: { id: true, mimeType: true, size: true, createdAt: true },
  });
  return NextResponse.json({ filename, exists: !!blob, blob });
}
