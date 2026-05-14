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

  // If this blob is referenced by an employee Document row, enforce that
  // row's visibility / ownership. Files used outside the Document table
  // (resumes, templates, fill packets) keep their existing auth-only access.
  const role = session.user?.role;
  const requesterEmployeeId = session.user?.employeeId ?? null;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";

  const docRow = await db.document.findFirst({
    where: { url: `/api/onboarding-docs/${filename}` },
    select: {
      visibility: true,
      employeeId: true,
      employee: { select: { managerId: true } },
    },
  });

  if (docRow) {
    if (docRow.visibility === "HR_ONLY" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (docRow.visibility === "EVERYONE" && !isAdmin) {
      const isOwner = requesterEmployeeId === docRow.employeeId;
      const isManager =
        requesterEmployeeId != null && docRow.employee?.managerId === requesterEmployeeId;
      if (!isOwner && !isManager) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
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
      "Cache-Control": "private, no-store",
    },
  });
}
