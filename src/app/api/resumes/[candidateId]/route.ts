import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");
const JOBING_BASE = "https://api.pro.jobing.com";

function blobFilename(candidateId: string): string {
  // Stable filename keyed by candidate so first-write wins and subsequent
  // refreshes overwrite the same row instead of accumulating duplicates.
  return `resume-${candidateId}.pdf`;
}

async function tryFetchFromJobing(candidateId: string): Promise<Buffer | null> {
  try {
    const apiKey = process.env.NOLIG_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(`${JOBING_BASE}/resumes/${candidateId}`, {
      headers: { Authorization: `Bearer token=${apiKey}` },
    });
    if (!res.ok) {
      const res2 = await fetch(`${JOBING_BASE}/candidates/${candidateId}/resume`, {
        headers: { Authorization: `Bearer token=${apiKey}` },
      });
      if (!res2.ok) return null;
      const buf = Buffer.from(await res2.arrayBuffer());
      if (buf.length < 100) return null;
      return buf;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

function pdfResponse(buffer: Buffer, candidateId: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${candidateId}.pdf"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

async function persistToBlob(candidateId: string, buffer: Buffer) {
  const filename = blobFilename(candidateId);
  // Prisma 7 expects Bytes as Uint8Array<ArrayBuffer>; a Node Buffer's
  // backing store can be SharedArrayBuffer which the generated type
  // doesn't accept. Copy into a clean Uint8Array before persisting.
  const bytes = new Uint8Array(buffer);
  try {
    await db.fileBlob.upsert({
      where: { filename },
      update: { data: bytes, size: bytes.length, mimeType: "application/pdf" },
      create: { filename, data: bytes, size: bytes.length, mimeType: "application/pdf" },
    });
  } catch (err) {
    console.error(`[resumes] FileBlob upsert failed for ${candidateId}:`, err);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { candidateId } = await params;

  if (!/^[a-zA-Z0-9-]+$/.test(candidateId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  // 1. FileBlob (persistent — survives Railway redeploys).
  const blob = await db.fileBlob.findUnique({
    where: { filename: blobFilename(candidateId) },
    select: { data: true },
  });
  if (blob) {
    return pdfResponse(Buffer.from(blob.data), candidateId);
  }

  // 2. Legacy local disk fallback. If found, migrate it into FileBlob
  //    so we never depend on disk again for this candidate.
  const filePath = path.join(RESUMES_DIR, `${candidateId}.pdf`);
  if (existsSync(filePath)) {
    const fileBuffer = await readFile(filePath);
    await persistToBlob(candidateId, fileBuffer);
    return pdfResponse(fileBuffer, candidateId);
  }

  // 3. Confirm the candidate exists before going to the upstream.
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // 4. Last resort: try to re-fetch from Jobing. On success, persist + serve.
  const buffer = await tryFetchFromJobing(candidateId);
  if (buffer) {
    await persistToBlob(candidateId, buffer);
    // Keep the legacy disk write too — harmless and useful in local dev.
    try {
      await mkdir(RESUMES_DIR, { recursive: true });
      await writeFile(filePath, buffer);
    } catch {
      // best-effort
    }
    return pdfResponse(buffer, candidateId);
  }

  return NextResponse.json({ error: "Resume not found" }, { status: 404 });
}
