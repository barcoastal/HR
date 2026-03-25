import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { filename } = await params;

  // Sanitize: only allow uuid.ext pattern
  if (!/^[a-zA-Z0-9-]+\.[a-z]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const blob = await db.fileBlob.findUnique({
    where: { filename },
    select: { data: true, mimeType: true },
  });

  if (!blob) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(blob.data, {
    headers: {
      "Content-Type": blob.mimeType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
