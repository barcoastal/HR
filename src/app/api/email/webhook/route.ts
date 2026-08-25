import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const FAILURE_STATUSES = new Set(["FAILED", "BOUNCED", "SUPPRESSED", "COMPLAINED"]);

type ResendEmailEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string[];
    subject?: string;
    failed?: { reason?: string };
    bounce?: { message?: string };
    suppressed?: { message?: string };
  };
};

function verifyWebhook(rawBody: string, headers: Headers): boolean {
  const secretValue = process.env.RESEND_WEBHOOK_SECRET;
  const messageId = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secretValue || !messageId || !timestamp || !signatures) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }

  try {
    const encodedSecret = secretValue.startsWith("whsec_") ? secretValue.slice(6) : secretValue;
    const secret = Buffer.from(encodedSecret, "base64");
    const expected = createHmac("sha256", secret)
      .update(`${messageId}.${timestamp}.${rawBody}`)
      .digest();

    return signatures
      .split(" ")
      .map((part) => part.split(","))
      .filter(([version, signature]) => version === "v1" && Boolean(signature))
      .some(([, signature]) => {
        const received = Buffer.from(signature, "base64");
        return received.length === expected.length && timingSafeEqual(received, expected);
      });
  } catch {
    return false;
  }
}

function statusForEvent(type: string): string | null {
  const statuses: Record<string, string> = {
    "email.sent": "SENT",
    "email.delivered": "DELIVERED",
    "email.delivery_delayed": "DELAYED",
    "email.failed": "FAILED",
    "email.bounced": "BOUNCED",
    "email.suppressed": "SUPPRESSED",
    "email.complained": "COMPLAINED",
  };
  return statuses[type] || null;
}

function failureReason(event: ResendEmailEvent): string | null {
  return event.data?.failed?.reason
    || event.data?.bounce?.message
    || event.data?.suppressed?.message
    || (event.type === "email.complained" ? "Recipient reported the message as spam" : null);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: ResendEmailEvent;
  try {
    event = JSON.parse(rawBody) as ResendEmailEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerId = event.data?.email_id;
  const status = statusForEvent(event.type);
  if (!providerId || !status) return NextResponse.json({ ok: true, ignored: true });

  const occurredAt = new Date(event.created_at || event.data?.created_at || Date.now());
  const reason = failureReason(event);
  const existing = await db.emailDelivery.findUnique({ where: { providerId } });
  const resolvedStatus = existing && (
    (FAILURE_STATUSES.has(existing.status) && !FAILURE_STATUSES.has(status))
    || (existing.status === "DELIVERED" && (status === "SENT" || status === "DELAYED"))
  ) ? existing.status : status;
  const resolvedReason = resolvedStatus === status ? reason : existing?.error || null;

  const delivery = existing
    ? await db.emailDelivery.update({
        where: { providerId },
        data: {
          status: resolvedStatus,
          error: resolvedReason,
          ...(resolvedStatus === "SENT" ? { sentAt: existing.sentAt || occurredAt } : {}),
          ...(resolvedStatus === "DELIVERED" ? { deliveredAt: existing.deliveredAt || occurredAt } : {}),
          ...(FAILURE_STATUSES.has(resolvedStatus) ? { failedAt: existing.failedAt || occurredAt } : {}),
        },
      })
    : await db.emailDelivery.create({
        data: {
          providerId,
          recipient: event.data?.to?.join(", ") || "Unknown recipient",
          subject: event.data?.subject || "Automated email",
          status: resolvedStatus,
          error: resolvedReason,
          sentAt: resolvedStatus === "SENT" ? occurredAt : null,
          deliveredAt: resolvedStatus === "DELIVERED" ? occurredAt : null,
          failedAt: FAILURE_STATUSES.has(resolvedStatus) ? occurredAt : null,
        },
      });

  if (delivery.contextType === "PRE_ADVERSE_ACTION" && delivery.contextId) {
    await db.candidate.updateMany({
      where: { id: delivery.contextId },
      data: {
        preAdverseActionStatus: resolvedStatus,
        preAdverseActionError: resolvedReason,
      },
    });
  }

  if (
    FAILURE_STATUSES.has(resolvedStatus)
    && delivery.senderEmployeeId
    && (!existing || !FAILURE_STATUSES.has(existing.status))
  ) {
    await db.notification.create({
      data: {
        recipientId: delivery.senderEmployeeId,
        type: "EMAIL_DELIVERY_FAILED",
        message: `Email to ${delivery.recipient} ${resolvedStatus.toLowerCase()}: ${delivery.subject}.${resolvedReason ? ` ${resolvedReason}` : ""}`,
        link: "/notifications",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
