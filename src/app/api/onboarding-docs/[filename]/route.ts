import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { canViewDocument, isSuperAdminOnlyDocument } from "@/lib/document-access";
import { isFileBlockedFor } from "@/lib/restricted-files";

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

  // Run the visibility check + blob fetch in parallel. Document.url now has
  // an index so the visibility lookup is O(log n) instead of a table scan.
  // Files NOT referenced by a Document row (resumes, templates, fill
  // packets) only require an authenticated session.
  const role = session.user?.role;
  const requesterEmployeeId = session.user?.employeeId ?? null;

  // Cached background-check reports, and any file a Document row files as an
  // I-9 / background check, are Super Admin only. 404 so the file's existence
  // isn't confirmed to anyone else.
  if (await isFileBlockedFor(role, { filename })) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const [docRow, blob] = await Promise.all([
    db.document.findFirst({
      where: { url: `/api/onboarding-docs/${filename}` },
      select: {
        id: true,
        name: true,
        category: true,
        visibility: true,
        employeeId: true,
        employee: { select: { managerId: true } },
      },
    }),
    db.fileBlob.findUnique({
      where: { filename },
      select: { data: true, mimeType: true },
    }),
  ]);

  if (docRow) {
    const allowed = canViewDocument(
      { role, employeeId: requesterEmployeeId },
      { ...docRow, managerId: docRow.employee?.managerId ?? null }
    );
    if (!allowed) {
      // I-9s and background checks answer 404 so their existence isn't leaked.
      return isSuperAdminOnlyDocument(docRow)
        ? NextResponse.json({ error: "File not found" }, { status: 404 })
        : NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isSuperAdminOnlyDocument(docRow) && blob) {
      const { audit } = await import("@/lib/audit");
      await audit({
        action: docRow.category === "I9" ? "i9.downloaded" : "background_check_document.downloaded",
        entityType: "document",
        entityId: docRow.id,
        details: { employeeId: docRow.employeeId, name: docRow.name },
      });
    }
  }

  if (!blob) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Force application/pdf for .pdf files so the browser previews them inline
  // — some FileBlob rows have application/octet-stream which triggers Chrome
  // to download instead of render in iframes. Strip the filename from the
  // Content-Disposition for the same reason (filename= acts as a download
  // hint in some Chrome configurations).
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  const contentType = isPdf ? "application/pdf" : blob.mimeType;
  return new NextResponse(blob.data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
