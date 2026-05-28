import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { existsSync, statSync } from "fs";
import path from "path";

const CRON_SECRET = process.env.CRON_SECRET || "";
const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = url.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "pass ?q=name or email" }, { status: 400 });

  const rows = await db.candidate.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      source: true,
      createdAt: true,
      resumeUrl: true,
    },
    take: 10,
  });

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const onDisk = r.resumeUrl?.startsWith("/api/resumes/")
        ? existsSync(path.join(RESUMES_DIR, `${r.id}.pdf`))
        : false;
      const onDiskSize = onDisk
        ? (() => {
            try { return statSync(path.join(RESUMES_DIR, `${r.id}.pdf`)).size; }
            catch { return null; }
          })()
        : null;
      const blob = await db.fileBlob.findUnique({
        where: { filename: `resume-${r.id}.pdf` },
        select: { id: true, size: true },
      });
      return { ...r, onDisk, onDiskSize, inBlob: !!blob, blobSize: blob?.size ?? null };
    })
  );

  return NextResponse.json({ matches: enriched });
}
