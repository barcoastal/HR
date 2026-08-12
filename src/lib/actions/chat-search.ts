"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { displayFirstName, displayName } from "@/lib/utils";

export async function searchChat(query: string) {
  await requireAuth();
  if (!query || query.length < 2) return { messages: [], channels: [], people: [] };

  const q = query.toLowerCase();

  // Search messages by contentPlain
  const messages = await db.message.findMany({
    where: {
      isDeleted: false,
      contentPlain: { contains: q, mode: "insensitive" },
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true } },
      channel: { select: { id: true, name: true } },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  // Search channels
  const channels = await db.channel.findMany({
    where: {
      isArchived: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, description: true, isPrivate: true },
    take: 5,
  });

  // Search people
  const people = await db.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { preferredName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
      status: { in: ["ACTIVE", "ONBOARDING", "PRE_ONBOARDING"] },
    },
    select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true, jobTitle: true },
    take: 5,
  });

  return {
    messages: messages.map((m) => ({
      id: m.id,
      content: m.contentPlain.slice(0, 100),
      channelId: m.channelId || m.dmThreadId,
      channelName: m.channel?.name || "DM",
      authorName: displayName(m.author),
      authorPhoto: m.author.profilePhoto,
      createdAt: m.createdAt.toISOString(),
    })),
    channels,
    people: people.map((p) => ({ ...p, firstName: displayFirstName(p) })),
  };
}
