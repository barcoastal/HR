import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isContinentalConfigured, listInvitations } from "@/lib/continental";

/**
 * POST /api/background-check/link
 * Body: { candidateId: string }
 *
 * Searches Continental Screening's invitations for any order tied to the
 * candidate's email address and, if exactly one match is found, persists its
 * OrderID on the candidate as backgroundCheckId. Status polling and the
 * report PDF then work as if the order had been placed from here.
 *
 * Used when a check was ordered outside of CALATRAVA (or the order failed to
 * record the id on our side) and an admin needs to wire it up after the fact.
 */
export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isContinentalConfigured()) {
    return NextResponse.json({ error: "Continental credentials not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : null;
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      backgroundCheckId: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (candidate.backgroundCheckId) {
    return NextResponse.json({ alreadyLinked: true, reportKey: candidate.backgroundCheckId });
  }

  let matches: { orderId: string; status?: string; signDate?: string | null }[];
  try {
    const invitations = await listInvitations();
    const email = candidate.email.trim().toLowerCase();
    const seen = new Set<string>();
    matches = [];
    for (const inv of invitations) {
      if ((inv.ApplicantEmail || "").trim().toLowerCase() !== email) continue;
      const orderId = inv.OrderID ? String(inv.OrderID) : null;
      if (!orderId || seen.has(orderId)) continue;
      seen.add(orderId);
      matches.push({ orderId, status: inv.Status, signDate: inv.SignDate });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Could not reach Continental Screening", details: msg }, { status: 502 });
  }

  if (matches.length === 0) {
    return NextResponse.json(
      {
        error: "No Continental order found for this candidate",
        details: `Searched invitations by email ${candidate.email}. Confirm the check was ordered and that the email on file matches the one used at Continental.`,
      },
      { status: 404 }
    );
  }

  if (matches.length > 1) {
    return NextResponse.json(
      {
        error: "Multiple orders matched — cannot link automatically",
        candidates: matches,
        details: "Confirm the right OrderID in the Continental client portal and contact engineering to wire it up.",
      },
      { status: 409 }
    );
  }

  const orderId = matches[0].orderId;
  await db.candidate.update({
    where: { id: candidate.id },
    data: { backgroundCheckId: orderId },
  });

  return NextResponse.json({ linkedReportKey: orderId });
}
