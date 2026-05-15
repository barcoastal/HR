import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");
const JOBING_BASE = "https://api.pro.jobing.com";

async function tryFetchFromJobing(candidateId: string): Promise<Buffer | null> {
  try {
    const apiKey = process.env.NOLIG_API_KEY;
    if (!apiKey) return null;

    // Try fetching from Jobing API using candidate ID
    const res = await fetch(`${JOBING_BASE}/resumes/${candidateId}`, {
      headers: { Authorization: `Bearer token=${apiKey}` },
    });

    if (!res.ok) {
      // Also try with /candidates/{id}/resume endpoint
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  // Resumes belong to the recruitment pipeline — gate to recruitment-capable roles.
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { candidateId } = await params;

  if (!/^[a-zA-Z0-9-]+$/.test(candidateId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const filePath = path.join(RESUMES_DIR, `${candidateId}.pdf`);

  // If local file exists, serve it
  if (existsSync(filePath)) {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${candidateId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Try to find the original Jobing resume URL from the candidate's source data
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, source: true, notes: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Try to re-fetch from Jobing
  const buffer = await tryFetchFromJobing(candidateId);
  if (buffer) {
    // Save locally for next time
    await mkdir(RESUMES_DIR, { recursive: true });
    await writeFile(filePath, buffer);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${candidateId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json({ error: "Resume not found" }, { status: 404 });
}
