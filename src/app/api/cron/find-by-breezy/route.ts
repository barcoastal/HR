import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const breezyId = url.searchParams.get("breezyId");
  if (!breezyId) return NextResponse.json({ error: "pass ?breezyId=" }, { status: 400 });

  const candidate = await db.candidate.findFirst({
    where: { resumeUrl: { contains: breezyId } },
    select: { id: true, firstName: true, lastName: true, email: true, resumeUrl: true, createdAt: true },
  });
  if (!candidate) return NextResponse.json({ error: "not found", breezyId });

  const blob = await db.fileBlob.findUnique({
    where: { filename: `resume-${candidate.id}.pdf` },
    select: { id: true, size: true, mimeType: true, createdAt: true },
  });

  return NextResponse.json({ candidate, blob });
}
