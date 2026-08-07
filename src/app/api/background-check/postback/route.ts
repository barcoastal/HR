import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fireBgCheckCompleteNotification,
  getOrder,
  hasRecords,
  isContinentalConfigured,
  listInvitations,
  mapOrderStatus,
  storeReportPdf,
  type ContinentalSearch,
} from "@/lib/continental";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/background-check/postback?secret=...
 *
 * Continental Screening calls this URL asynchronously as an order progresses
 * (we pass it as `postbackurl` when creating the order). The payload carries
 * the order's searches and, once complete, the report PDF base64-encoded.
 *
 * The exact shape isn't fully documented, so parsing is defensive: we log a
 * redacted summary of every delivery, pull out whatever we recognize, and
 * fall back to polling GET /orders/{id} for anything missing.
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    const text = await req.text().catch(() => "");
    console.error("[bg-postback] non-JSON delivery:", text.slice(0, 500));
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  // The interesting fields may sit at the top level or under `payload`.
  const payload = (typeof body.payload === "object" && body.payload !== null
    ? (body.payload as Record<string, unknown>)
    : body) as Record<string, unknown>;

  const orderId = firstString(payload.OrderID, payload.orderID, payload.orderid, body.OrderID, body.orderID);
  console.log(
    `[bg-postback] delivery for order ${orderId ?? "?"} — keys: ${Object.keys(body).join(",")} / payload keys: ${Object.keys(payload).join(",")}`
  );

  if (!orderId) {
    return NextResponse.json({ error: "No OrderID in postback payload" }, { status: 400 });
  }

  const candidateSelect = {
    id: true,
    firstName: true,
    lastName: true,
    backgroundCheckStatus: true,
    backgroundReportFilename: true,
    position: { select: { title: true } },
  } as const;

  let candidate = await db.candidate.findFirst({
    where: { backgroundCheckId: orderId },
    select: candidateSelect,
  });

  // Invitation orders are stored as INV-<invitationID> until the applicant
  // signs — if this is the first we hear of the OrderID, resolve it through
  // the invitations list and upgrade the stored key.
  if (!candidate && isContinentalConfigured()) {
    try {
      const invitations = await listInvitations();
      const invitation = invitations.find((i) => String(i.OrderID ?? "") === orderId);
      if (invitation?.ID) {
        candidate = await db.candidate.findFirst({
          where: { backgroundCheckId: `INV-${invitation.ID}` },
          select: candidateSelect,
        });
        if (candidate) {
          await db.candidate.update({
            where: { id: candidate.id },
            data: { backgroundCheckId: orderId },
          });
          console.log(`[bg-postback] linked invitation INV-${invitation.ID} → order ${orderId}`);
        }
      }
    } catch (err) {
      console.error(`[bg-postback] invitation lookup failed for order ${orderId}:`, err);
    }
  }

  if (!candidate) {
    console.error(`[bg-postback] no candidate linked to Continental order ${orderId}`);
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  // Store the report PDF if this delivery carries one.
  const pdfBase64 = firstString(payload.PDF, payload.pdf, body.PDF, body.pdf);
  if (pdfBase64 && !candidate.backgroundReportFilename) {
    try {
      await storeReportPdf(candidate.id, orderId, pdfBase64);
      console.log(`[bg-postback] stored report PDF for order ${orderId}`);
    } catch (err) {
      console.error(`[bg-postback] failed to store PDF for order ${orderId}:`, err);
    }
  }

  // Work out the order status — prefer the delivered data, fall back to the API.
  let orderStatus = firstString(payload.OrderStatus, payload.orderstatus, body.OrderStatus);
  let searches = (Array.isArray(payload.Searches) ? payload.Searches : null) as ContinentalSearch[] | null;
  if ((!orderStatus || !searches) && isContinentalConfigured()) {
    try {
      const order = await getOrder(orderId);
      orderStatus = orderStatus || order.OrderStatus;
      searches = searches || order.Searches || null;
    } catch (err) {
      console.error(`[bg-postback] order refetch failed for ${orderId}:`, err);
    }
  }

  const newStatus = mapOrderStatus({ OrderStatus: orderStatus, Searches: searches || undefined });
  if (
    (newStatus === "PASSED" || newStatus === "FAILED") &&
    newStatus !== candidate.backgroundCheckStatus
  ) {
    await db.candidate.update({
      where: { id: candidate.id },
      data: { backgroundCheckStatus: newStatus },
    });
    await fireBgCheckCompleteNotification(candidate.id, newStatus, candidate);
    console.log(
      `[bg-postback] order ${orderId} → ${newStatus}` +
        (searches ? ` (${searches.filter(hasRecords).length}/${searches.length} searches with records)` : "")
    );
  }

  return NextResponse.json({ ok: true });
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
