import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/**
 * GET /api/background-check/{reportKey}/pdf
 * Streams the completed background-check report PDF from
 * backgroundchecks.com so an admin can review it inside our platform.
 * Gated to recruitment-capable roles.
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

  if (!BG_CHECK_API_KEY) {
    return NextResponse.json({ error: "Background check is not configured on the server" }, { status: 500 });
  }

  const { reportKey } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(reportKey)) {
    return NextResponse.json({ error: "Invalid report key" }, { status: 400 });
  }

  // Confirm this report key belongs to a candidate in our DB before proxying.
  const owner = await db.candidate.findFirst({
    where: { backgroundCheckId: reportKey },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!owner) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // backgroundchecks.com's PDF endpoint lives at /report/{key}/pdf (singular).
  // It responds with a 302 to a signed S3-style URL — fetch follows the
  // redirect and returns the PDF binary.
  const candidates = [
    `${BG_CHECK_BASE}/report/${reportKey}/pdf?api_token=${BG_CHECK_API_KEY}`,
    // Legacy fallbacks just in case some report_keys still use the old paths.
    `${BG_CHECK_BASE}/reports/${reportKey}/pdf?api_token=${BG_CHECK_API_KEY}`,
    `${BG_CHECK_BASE}/reports/${reportKey}/report.pdf?api_token=${BG_CHECK_API_KEY}`,
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

      const safeName = `${owner.firstName}_${owner.lastName}`.replace(/[^a-zA-Z0-9_-]/g, "");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="background-check-${safeName}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      // Try the next path
    }
  }

  return NextResponse.json(
    {
      error: "Could not fetch report PDF from backgroundchecks.com",
      details: "None of the known PDF endpoints returned a PDF. The report may not be complete yet, or backgroundchecks.com may use a different path on your account — try opening the report from the backgroundchecks.com dashboard.",
    },
    { status: 502 }
  );
}
