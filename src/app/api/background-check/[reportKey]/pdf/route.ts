import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/**
 * GET /api/background-check/{reportKey}/pdf
 *
 * Streams the completed background-check report PDF so admins can review it
 * inside the platform. On first successful fetch from backgroundchecks.com
 * we cache the bytes into FileBlob and stamp the candidate's
 * backgroundReportFilename so subsequent loads (and future expirations of
 * the provider's signed URL) keep working.
 *
 * Gated to SUPER_ADMIN / ADMIN / HR.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportKey: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reportKey } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(reportKey)) {
    return NextResponse.json({ error: "Invalid report key" }, { status: 400 });
  }

  const owner = await db.candidate.findFirst({
    where: { backgroundCheckId: reportKey },
    select: { id: true, firstName: true, lastName: true, backgroundReportFilename: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // safeName previously used in Content-Disposition filename — now stripped
  // for inline-preview reliability across Chrome configurations.

  // Prefer the cached copy if we've already imported it.
  if (owner.backgroundReportFilename) {
    const blob = await db.fileBlob.findUnique({
      where: { filename: owner.backgroundReportFilename },
      select: { data: true, mimeType: true },
    });
    if (blob) {
      return new NextResponse(blob.data, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }

  if (!BG_CHECK_API_KEY) {
    return NextResponse.json({ error: "Background check is not configured on the server" }, { status: 500 });
  }

  // /report/{key}/pdf is the working endpoint — it returns a 302 to a signed
  // S3-style URL. fetch with redirect:follow grabs the binary in one go.
  const candidates = [
    `${BG_CHECK_BASE}/report/${reportKey}/pdf?api_token=${BG_CHECK_API_KEY}`,
    `${BG_CHECK_BASE}/reports/${reportKey}/pdf?api_token=${BG_CHECK_API_KEY}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/pdf,application/octet-stream,*/*" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 100) continue;

      // Cache the PDF as a FileBlob and link it on the candidate so the next
      // load skips the live fetch entirely (and survives signed-URL expiry).
      try {
        const filename = `bg-report-${reportKey}-${randomUUID()}.pdf`;
        await db.fileBlob.create({
          data: {
            filename,
            mimeType: "application/pdf",
            size: buffer.length,
            data: buffer,
          },
        });
        await db.candidate.update({
          where: { id: owner.id },
          data: {
            backgroundReportFilename: filename,
            backgroundReportImportedAt: new Date(),
          },
        });
      } catch (cacheErr) {
        console.error("[bg-check] failed to cache report PDF:", cacheErr);
        // Still serve the live fetch even if caching failed.
      }

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // try the next URL
    }
  }

  return NextResponse.json(
    {
      error: "Could not fetch report PDF from backgroundchecks.com",
      details: "The report may not be complete yet, or your API token doesn't have access to this report. Try opening it directly on backgroundchecks.com.",
    },
    { status: 502 }
  );
}
