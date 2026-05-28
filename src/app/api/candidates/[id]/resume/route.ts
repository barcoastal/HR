import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

/**
 * POST /api/candidates/{id}/resume
 * Manual resume attach — used when an ATS (e.g. Breezy) won't let us
 * download the PDF programmatically. Accepts multipart form with a `file`
 * field, stores the bytes in FileBlob (persistent), mirrors to disk, and
 * rewrites the candidate's resumeUrl to /api/resumes/{id}.
 *
 * HR / ADMIN / SUPER_ADMIN / MANAGER only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid candidate ID" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength < 100) {
    return NextResponse.json({ error: "File is empty or too small" }, { status: 400 });
  }
  const buffer = Buffer.from(arrayBuffer);
  const bytes = new Uint8Array(buffer);
  const filename = `resume-${id}.pdf`;

  try {
    await db.fileBlob.upsert({
      where: { filename },
      update: { data: bytes, size: bytes.length, mimeType: "application/pdf" },
      create: { filename, data: bytes, size: bytes.length, mimeType: "application/pdf" },
    });
  } catch (err) {
    console.error(`[manual resume] FileBlob upsert failed for ${id}:`, err);
    return NextResponse.json({ error: "Failed to store resume" }, { status: 500 });
  }

  // Mirror to disk for fast dev access; FileBlob is the source of truth.
  try {
    await mkdir(RESUMES_DIR, { recursive: true });
    await writeFile(path.join(RESUMES_DIR, `${id}.pdf`), buffer);
  } catch {
    // best-effort
  }

  await db.candidate.update({
    where: { id },
    data: { resumeUrl: `/api/resumes/${id}` },
  });

  return NextResponse.json({ success: true, resumeUrl: `/api/resumes/${id}` });
}
