import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-helpers";
import {
  buildProductList,
  createInvitationOrder,
  fireBgCheckCompleteNotification,
  getOrder,
  isContinentalConfigured,
  listInvitations,
  mapOrderStatus,
  ContinentalError,
  type BgCheckOptions,
} from "@/lib/continental";

// POST /api/background-check  — initiate a background check order
export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { candidateId, options } = body as { candidateId: string; options?: BgCheckOptions };

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  // Sandbox: simulate a submitted order so the hiring flow stays testable
  // without hitting Continental or emailing the candidate.
  if (process.env.SANDBOX_MODE === "1") {
    const sbxCandidate = await db.candidate.findUnique({ where: { id: candidateId } });
    if (!sbxCandidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    await db.candidate.update({
      where: { id: candidateId },
      data: {
        status: "BACKGROUND_CHECK",
        backgroundCheckStatus: "PENDING",
        backgroundCheckId: `SBX-${candidateId.slice(0, 8)}`,
        backgroundCheckDate: new Date(),
        backgroundCheckOptions: JSON.stringify(options || {}),
      },
    });
    console.log(`[sandbox] background check simulated for candidate ${candidateId}`);
    return NextResponse.json({ success: true, sandbox: true, orderId: `SBX-${candidateId.slice(0, 8)}` });
  }

  if (!isContinentalConfigured()) {
    console.error("[background-check] CONTINENTAL_API_USER / CONTINENTAL_API_PASSWORD not set on the server");
    return NextResponse.json(
      { error: "Background check is not configured on the server (missing Continental credentials)" },
      { status: 500 }
    );
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!candidate.email) {
    return NextResponse.json(
      { error: "Candidate has no email on file — cannot send background check" },
      { status: 400 }
    );
  }

  console.log(`[background-check] submitting Continental invitation order for ${candidate.email} (${candidateId})`);

  let orderId: string;
  try {
    ({ orderId } = await createInvitationOrder({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      products: buildProductList(options),
    }));
  } catch (error) {
    if (error instanceof ContinentalError) {
      console.error(`[background-check] Continental order failed (${error.httpStatus}): ${error.message} ${error.details || ""}`);
      return NextResponse.json(
        { error: `Continental Screening rejected the order`, details: error.message },
        { status: 502 }
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[background-check] fetch to Continental failed:", msg);
    return NextResponse.json({ error: "Could not reach Continental Screening", details: msg }, { status: 502 });
  }

  await db.candidate.update({
    where: { id: candidateId },
    data: {
      status: "BACKGROUND_CHECK",
      backgroundCheckStatus: "AWAITING_APPLICANT",
      backgroundCheckId: orderId,
      backgroundCheckDate: new Date(),
      backgroundCheckOptions: JSON.stringify(options || {}),
    },
  });

  console.log(`[background-check] Continental order created for ${candidate.email}: orderID=${orderId}`);

  return NextResponse.json({
    success: true,
    reportKey: orderId,
    inviteUrl: null,
    status: "AWAITING_APPLICANT",
  });
}

// GET /api/background-check?candidateId=xxx  — check/refresh status from API
export async function GET(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const candidateId = req.nextUrl.searchParams.get("candidateId");

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      backgroundCheckStatus: true,
      backgroundCheckId: true,
      backgroundCheckDate: true,
      firstName: true,
      lastName: true,
      position: { select: { title: true } },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Poll the live status from Continental. Orders are numeric; skip sandbox
  // ids and legacy backgroundchecks.com report keys.
  if (
    candidate.backgroundCheckId &&
    /^\d+$/.test(candidate.backgroundCheckId) &&
    isContinentalConfigured()
  ) {
    try {
      const order = await getOrder(candidate.backgroundCheckId);
      let invitation = null;
      if ((order.OrderStatus || "").toLowerCase() !== "closed") {
        try {
          const invitations = await listInvitations();
          invitation = invitations.find((i) => String(i.OrderID) === candidate.backgroundCheckId) || null;
        } catch {
          // invitation lookup is best-effort
        }
      }
      const newStatus = mapOrderStatus(order, invitation);

      if (newStatus !== candidate.backgroundCheckStatus) {
        await db.candidate.update({
          where: { id: candidateId },
          data: { backgroundCheckStatus: newStatus },
        });
        // No auto-send of the adverse-action letter here. Flipping to
        // REJECTED + emailing the candidate is a manual decision — the UI
        // shows a banner with a "Send Adverse Action Letter" button when
        // status is FAILED.

        // Fire an in-app + email notification the first time the check
        // resolves to PASSED or FAILED so recruiters/HR see the result.
        if (newStatus === "PASSED" || newStatus === "FAILED") {
          await fireBgCheckCompleteNotification(candidateId, newStatus, candidate);
        }
      }

      return NextResponse.json({
        status: newStatus,
        apiStatus: order.OrderStatus || null,
        flagged: newStatus === "FAILED",
        reports: order.Searches || null,
        checkId: candidate.backgroundCheckId,
        date: candidate.backgroundCheckDate,
      });
    } catch {
      // API unreachable — return cached status
    }
  }

  return NextResponse.json({
    status: candidate.backgroundCheckStatus,
    checkId: candidate.backgroundCheckId,
    date: candidate.backgroundCheckDate,
  });
}

// PATCH /api/background-check  — manually update status
export async function PATCH(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { candidateId, status } = await req.json();

  if (!candidateId || !status) {
    return NextResponse.json({ error: "candidateId and status required" }, { status: 400 });
  }

  if (!["PASSED", "FAILED"].includes(status)) {
    return NextResponse.json({ error: "status must be PASSED or FAILED" }, { status: 400 });
  }

  const previousCheck = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      backgroundCheckStatus: true,
      firstName: true,
      lastName: true,
      position: { select: { title: true } },
    },
  });
  await db.candidate.update({
    where: { id: candidateId },
    data: { backgroundCheckStatus: status },
  });

  if (previousCheck && previousCheck.backgroundCheckStatus !== status && (status === "PASSED" || status === "FAILED")) {
    await fireBgCheckCompleteNotification(candidateId, status, previousCheck);
  }

  // No auto-send of the adverse-action letter here either. The UI shows a
  // dedicated "Send Adverse Action Letter" button next to the FAILED pill
  // and the user has to click it explicitly. This avoids accidentally
  // rejecting + emailing a candidate just because someone clicked
  // "Mark Failed" or hit Refresh Status.

  return NextResponse.json({ success: true, status });
}
