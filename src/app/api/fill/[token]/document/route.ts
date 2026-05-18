import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — serves the document for a valid fill token (no auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const request = await db.signingRequest.findUnique({
    where: { token },
  });

  if (!request || request.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const docUrl = request.documentUrl;
  const filename = docUrl.split("/").pop();
  if (!filename || !/^[a-zA-Z0-9-]+\.[a-z]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }

  const blob = await db.fileBlob.findUnique({
    where: { filename },
    select: { data: true, mimeType: true },
  });

  if (!blob) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return new NextResponse(blob.data, {
    headers: {
      "Content-Type": blob.mimeType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
