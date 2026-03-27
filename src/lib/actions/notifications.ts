"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function getCurrentEmployeeId(): Promise<string | null> {
  const { getSession } = await import("@/lib/auth-helpers");
  const session = await getSession();
  return session?.user?.employeeId || null;
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<{ notifications: { id: string; type: string; message: string; link: string | null; read: boolean; createdAt: string }[]; total: number; unreadCount: number }> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return { notifications: [], total: 0, unreadCount: 0 };

  const limit = params?.limit || 20;
  const offset = params?.offset || 0;

  const where: Record<string, unknown> = { recipientId: employeeId };

  // Map filter categories to notification types
  if (params?.type) {
    const typeMap: Record<string, string[]> = {
      stage_changes: ["STAGE_CHANGE"],
      signing: ["OFFER_SENT", "OFFER_SIGNED", "DOCUMENT_SIGN_REQUEST", "DOCUMENT_SIGNED"],
      onboarding: ["NEW_HIRE", "TASK_ASSIGNED", "ONBOARDING_COMPLETED"],
      interviews: ["INTERVIEW_SCHEDULED"],
      feed: ["FEED_POST", "FEED_EVENT"],
    };
    const types = typeMap[params.type];
    if (types) where.type = { in: types };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { recipientId: employeeId, read: false } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    unreadCount,
  };
}

export async function getUnreadCount(): Promise<number> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return 0;
  return db.notification.count({ where: { recipientId: employeeId, read: false } });
}

export async function markAsRead(id: string): Promise<void> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return;
  await db.notification.updateMany({
    where: { id, recipientId: employeeId },
    data: { read: true },
  });
}

export async function markAllAsRead(): Promise<void> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return;
  await db.notification.updateMany({
    where: { recipientId: employeeId, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
