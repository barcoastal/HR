import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// Public endpoint — serves the document for a valid signing token (no auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Validate token
  const request = await db.signingRequest.findUnique({
    where: { token },
  });

  if (!request || request.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 });
  }

  // Extract filename from documentUrl (e.g., "/api/onboarding-docs/uuid.pdf" → "uuid.pdf")
  const docUrl = request.documentUrl;
  const filename = docUrl.split("/").pop();
  if (!filename || !/^[a-zA-Z0-9-]+\.[a-z]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", "onboarding-docs", filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  const fileBuffer = await readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
