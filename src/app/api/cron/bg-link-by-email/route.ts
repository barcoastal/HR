import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isContinentalConfigured, listInvitations } from "@/lib/continental";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * GET /api/cron/bg-link-by-email?secret=...&email=...
 *
 * Looks up the candidate locally by email, then searches Continental
 * Screening's invitations for orders tied to that applicant. If exactly one
 * order is found, we link its OrderID to our candidate.backgroundCheckId so
 * status polling and the "View Report" button start working.
 *
 * Returns the matches either way so we can diagnose.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isContinentalConfigured()) {
    return NextResponse.json({ error: "Continental credentials not configured" }, { status: 500 });
  }

  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "pass ?email=..." }, { status: 400 });

  const candidate = await db.candidate.findUnique({
    where: { email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      backgroundCheckId: true,
      backgroundCheckStatus: true,
    },
  });
  if (!candidate) {
    return NextResponse.json({ error: "No candidate with that email" }, { status: 404 });
  }

  const invitations = await listInvitations();
  const wanted = email.trim().toLowerCase();
  const seen = new Set<string>();
  const found: { orderId: string; status?: string; signDate?: string | null; created?: string }[] = [];
  for (const inv of invitations) {
    if ((inv.ApplicantEmail || "").trim().toLowerCase() !== wanted) continue;
    const orderId = inv.OrderID ? String(inv.OrderID) : null;
    if (!orderId || seen.has(orderId)) continue;
    seen.add(orderId);
    found.push({ orderId, status: inv.Status, signDate: inv.SignDate, created: inv.DateCreated });
  }

  let linkedReportKey: string | null = null;
  if (found.length === 1 && !candidate.backgroundCheckId) {
    linkedReportKey = found[0].orderId;
    await db.candidate.update({
      where: { id: candidate.id },
      data: { backgroundCheckId: linkedReportKey },
    });
  }

  return NextResponse.json({
    candidate,
    linkedReportKey,
    candidatesFoundOnProvider: found,
  });
}
