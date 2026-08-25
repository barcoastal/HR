"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type EmailDeliverySummary = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
  senderName: string | null;
  contextType: string | null;
  contextId: string | null;
};

export type EmailDeliveryStats = {
  total: number;
  delivered: number;
  accepted: number;
  pending: number;
  issues: number;
};

const DELIVERY_STATUSES = new Set([
  "QUEUED",
  "SENT",
  "DELIVERED",
  "DELAYED",
  "FAILED",
  "BOUNCED",
  "SUPPRESSED",
  "COMPLAINED",
]);

function serializeDelivery(delivery: {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  contextType: string | null;
  contextId: string | null;
  sender: { firstName: string; preferredName: string | null; lastName: string } | null;
}): EmailDeliverySummary {
  return {
    id: delivery.id,
    recipient: delivery.recipient,
    subject: delivery.subject,
    status: delivery.status,
    error: delivery.error,
    sentAt: delivery.sentAt?.toISOString() || null,
    deliveredAt: delivery.deliveredAt?.toISOString() || null,
    failedAt: delivery.failedAt?.toISOString() || null,
    createdAt: delivery.createdAt.toISOString(),
    senderName: delivery.sender
      ? `${delivery.sender.preferredName || delivery.sender.firstName} ${delivery.sender.lastName}`
      : null,
    contextType: delivery.contextType,
    contextId: delivery.contextId,
  };
}

export async function getRecentEmailDeliveries(limit = 25): Promise<EmailDeliverySummary[]> {
  await requireAdmin();
  const deliveries = await db.emailDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: {
      sender: { select: { firstName: true, preferredName: true, lastName: true } },
    },
  });

  return deliveries.map(serializeDelivery);
}

export async function getEmailDeliveryLog(filters: {
  query?: string;
  status?: string;
  limit?: number;
} = {}): Promise<EmailDeliverySummary[]> {
  await requireAdmin();
  const query = filters.query?.trim();
  const status = filters.status && DELIVERY_STATUSES.has(filters.status)
    ? filters.status
    : undefined;
  const where: Prisma.EmailDeliveryWhereInput = {
    ...(status ? { status } : {}),
    ...(query ? {
      OR: [
        { recipient: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
        { contextType: { contains: query, mode: "insensitive" } },
      ],
    } : {}),
  };
  const deliveries = await db.emailDelivery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(250, filters.limit || 200)),
    include: {
      sender: { select: { firstName: true, preferredName: true, lastName: true } },
    },
  });
  return deliveries.map(serializeDelivery);
}

export async function getEmailDeliveryStats(): Promise<EmailDeliveryStats> {
  await requireAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recent = { createdAt: { gte: since } };
  const [total, delivered, accepted, pending, issues] = await Promise.all([
    db.emailDelivery.count({ where: recent }),
    db.emailDelivery.count({ where: { ...recent, status: "DELIVERED" } }),
    db.emailDelivery.count({ where: { ...recent, status: "SENT" } }),
    db.emailDelivery.count({ where: { ...recent, status: { in: ["QUEUED", "DELAYED"] } } }),
    db.emailDelivery.count({ where: { ...recent, status: { in: ["FAILED", "BOUNCED", "SUPPRESSED", "COMPLAINED"] } } }),
  ]);
  return { total, delivered, accepted, pending, issues };
}
