"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:3001";
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

async function broadcastToWs(event: any) {
  try {
    await fetch(`${WS_SERVER_URL}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WS_INTERNAL_SECRET}` },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error("Failed to broadcast to WS server:", error);
  }
}

export async function toggleReaction(messageId: string, emoji: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const message = await db.message.findUnique({ where: { id: messageId }, select: { channelId: true, dmThreadId: true } });
  if (!message) throw new Error("Message not found");
  const channelId = message.channelId || message.dmThreadId;

  const existing = await db.reaction.findUnique({
    where: { messageId_employeeId_emoji: { messageId, employeeId, emoji } },
  });

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
    if (channelId) {
      await broadcastToWs({ type: "reaction:remove", channelId, messageId, emoji, userId: employeeId });
    }
    return { action: "removed" };
  } else {
    await db.reaction.create({ data: { messageId, employeeId, emoji } });
    if (channelId) {
      await broadcastToWs({ type: "reaction:add", channelId, messageId, emoji, userId: employeeId });
    }
    return { action: "added" };
  }
}

export async function getReactions(messageId: string) {
  await requireAuth();
  return db.reaction.findMany({
    where: { messageId },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}
