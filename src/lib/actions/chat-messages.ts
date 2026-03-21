// src/lib/actions/chat-messages.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { BroadcastEvent, MessagePayload } from "@/lib/chat/ws-types";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:3001";
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

async function broadcastToWs(event: BroadcastEvent) {
  try {
    await fetch(`${WS_SERVER_URL}/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WS_INTERNAL_SECRET}`,
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error("Failed to broadcast to WS server:", error);
  }
}

export async function getMessages(
  channelId: string,
  options?: { cursor?: string; limit?: number; type?: "channel" | "dm" }
) {
  await requireAuth();

  const limit = options?.limit ?? 50;
  const isChannel = (options?.type ?? "channel") === "channel";

  const where = isChannel
    ? { channelId, isDeleted: false }
    : { dmThreadId: channelId, isDeleted: false };

  const messages = await db.message.findMany({
    where,
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, profilePhoto: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return {
    messages: messages.reverse(),
    hasMore,
    nextCursor: hasMore ? messages[0]?.id : undefined,
  };
}

export async function sendMessage(data: {
  channelId: string;
  content: string;
  contentPlain?: string;
  type?: "channel" | "dm";
}) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;
  const isChannel = (data.type ?? "channel") === "channel";

  const message = await db.message.create({
    data: {
      ...(isChannel ? { channelId: data.channelId } : { dmThreadId: data.channelId }),
      authorId: employeeId,
      content: data.content,
      contentPlain: data.contentPlain || data.content,
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, profilePhoto: true },
      },
    },
  });

  const payload: MessagePayload = {
    id: message.id,
    channelId: message.channelId,
    dmThreadId: message.dmThreadId,
    parentId: message.parentId,
    authorId: message.authorId,
    content: message.content,
    contentPlain: message.contentPlain,
    createdAt: message.createdAt.toISOString(),
    author: message.author,
  };

  await broadcastToWs({
    type: "message:new",
    channelId: data.channelId,
    message: payload,
  });

  return message;
}

export async function editMessage(messageId: string, content: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.authorId !== employeeId) {
    throw new Error("Unauthorized");
  }

  const message = await db.message.update({
    where: { id: messageId },
    data: { content, contentPlain: content, isEdited: true },
  });

  const channelId = message.channelId || message.dmThreadId;
  if (channelId) {
    await broadcastToWs({
      type: "message:update",
      channelId,
      messageId: message.id,
      content: message.content,
      contentPlain: message.contentPlain,
    });
  }

  return message;
}

export async function deleteMessage(messageId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.authorId !== employeeId) {
    throw new Error("Unauthorized");
  }

  await db.message.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  const channelId = existing.channelId || existing.dmThreadId;
  if (channelId) {
    await broadcastToWs({
      type: "message:delete",
      channelId,
      messageId,
    });
  }
}

export async function pinMessage(messageId: string, channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.pinnedMessage.findUnique({
    where: { channelId_messageId: { channelId, messageId } },
  });

  if (existing) {
    await db.pinnedMessage.delete({ where: { id: existing.id } });
    return { action: "unpinned" };
  }

  await db.pinnedMessage.create({
    data: { channelId, messageId, pinnedById: employeeId },
  });
  return { action: "pinned" };
}

export async function saveMessage(messageId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.savedMessage.findUnique({
    where: { employeeId_messageId: { employeeId, messageId } },
  });

  if (existing) {
    await db.savedMessage.delete({ where: { id: existing.id } });
    return { action: "unsaved" };
  }

  await db.savedMessage.create({ data: { employeeId, messageId } });
  return { action: "saved" };
}
