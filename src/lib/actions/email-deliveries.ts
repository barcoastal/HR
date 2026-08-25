"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export type EmailDeliverySummary = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  senderName: string | null;
};

export async function getRecentEmailDeliveries(limit = 25): Promise<EmailDeliverySummary[]> {
  await requireAdmin();
  const deliveries = await db.emailDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: {
      sender: { select: { firstName: true, preferredName: true, lastName: true } },
    },
  });

  return deliveries.map((delivery) => ({
    id: delivery.id,
    recipient: delivery.recipient,
    subject: delivery.subject,
    status: delivery.status,
    error: delivery.error,
    sentAt: delivery.sentAt?.toISOString() || null,
    deliveredAt: delivery.deliveredAt?.toISOString() || null,
    createdAt: delivery.createdAt.toISOString(),
    senderName: delivery.sender
      ? `${delivery.sender.preferredName || delivery.sender.firstName} ${delivery.sender.lastName}`
      : null,
  }));
}
