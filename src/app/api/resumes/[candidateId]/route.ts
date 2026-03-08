import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;

  // Sanitize: only allow uuid-like IDs
  if (!/^[a-zA-Z0-9-]+$/.test(candidateId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", "resumes", `${candidateId}.pdf`);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const fileBuffer = await readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${candidateId}.pdf"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
