"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { displayFirstName } from "@/lib/utils";

function toDisplay<T extends { firstName: string; preferredName?: string | null }>(person: T): T {
  return { ...person, firstName: displayFirstName(person) };
}

export async function getPinnedMessages(channelId: string) {
  await requireAuth();

  const pins = await db.pinnedMessage.findMany({
    where: { channelId },
    include: {
      message: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true },
          },
        },
      },
      pinnedBy: {
        select: { firstName: true, lastName: true, preferredName: true },
      },
    },
    orderBy: { pinnedAt: "desc" },
  });
  return pins.map((p) => ({
    ...p,
    message: { ...p.message, author: toDisplay(p.message.author) },
    pinnedBy: toDisplay(p.pinnedBy),
  }));
}

export async function getSavedMessages() {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const saved = await db.savedMessage.findMany({
    where: { employeeId },
    include: {
      message: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true },
          },
          channel: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });
  return saved.map((s) => ({
    ...s,
    message: { ...s.message, author: toDisplay(s.message.author) },
  }));
}
