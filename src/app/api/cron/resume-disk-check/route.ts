import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import path from "path";

const CRON_SECRET = process.env.CRON_SECRET || "";
const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sample 50 candidates whose resumeUrl looks like /api/resumes/<id>
  const candidates = await db.candidate.findMany({
    where: { resumeUrl: { startsWith: "/api/resumes/" } },
    select: { id: true, createdAt: true, resumeUrl: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let onDisk = 0;
  let missing = 0;
  let inBlob = 0;
  const samples: { id: string; created: string; onDisk: boolean; sizeOnDisk?: number; inBlob: boolean }[] = [];
  for (const c of candidates) {
    const file = path.join(RESUMES_DIR, `${c.id}.pdf`);
    const exists = existsSync(file);
    let size: number | undefined;
    if (exists) {
      try { size = (await stat(file)).size; } catch { /* ignore */ }
      onDisk++;
    } else {
      missing++;
    }
    const blob = await db.fileBlob.findUnique({
      where: { filename: `resume-${c.id}.pdf` },
      select: { id: true },
    });
    if (blob) inBlob++;
    samples.push({
      id: c.id,
      created: c.createdAt.toISOString(),
      onDisk: exists,
      sizeOnDisk: size,
      inBlob: !!blob,
    });
  }

  return NextResponse.json({
    sampled: candidates.length,
    summary: { onDisk, missing, inBlob },
    resumesDirExists: existsSync(RESUMES_DIR),
    samples: samples.slice(0, 10),
  });
}
