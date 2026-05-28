import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";
const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

/**
 * POST /api/cron/attach-resume?secret=...&candidateId=...
 * Body: raw PDF bytes (Content-Type: application/pdf)
 *
 * Used by the local Breezy scrape script to upload a downloaded resume
 * and attach it to a candidate. CRON_SECRET-auth — no user session
 * required so the script can run unattended.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const candidateId = url.searchParams.get("candidateId");
  if (!candidateId || !/^[a-zA-Z0-9-]+$/.test(candidateId)) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: { id: true } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length < 100) {
    return NextResponse.json({ error: "Body too small to be a PDF" }, { status: 400 });
  }
  // Quick PDF magic-byte sanity check.
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return NextResponse.json({ error: "Body is not a PDF (missing %PDF header)" }, { status: 400 });
  }

  const bytes = new Uint8Array(buffer);
  const filename = `resume-${candidateId}.pdf`;
  try {
    await db.fileBlob.upsert({
      where: { filename },
      update: { data: bytes, size: bytes.length, mimeType: "application/pdf" },
      create: { filename, data: bytes, size: bytes.length, mimeType: "application/pdf" },
    });
  } catch (err) {
    console.error(`[attach-resume] FileBlob upsert failed for ${candidateId}:`, err);
    return NextResponse.json({ error: "Failed to store resume" }, { status: 500 });
  }
  try {
    await mkdir(RESUMES_DIR, { recursive: true });
    await writeFile(path.join(RESUMES_DIR, `${candidateId}.pdf`), buffer);
  } catch {
    // best-effort
  }
  await db.candidate.update({
    where: { id: candidateId },
    data: { resumeUrl: `/api/resumes/${candidateId}` },
  });
  return NextResponse.json({ success: true, size: buffer.length });
}
