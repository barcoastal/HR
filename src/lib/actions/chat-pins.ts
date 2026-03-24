"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function getPinnedMessages(channelId: string) {
  await requireAuth();

  return db.pinnedMessage.findMany({
    where: { channelId },
    include: {
      message: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
        },
      },
      pinnedBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { pinnedAt: "desc" },
  });
}

export async function getSavedMessages() {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  return db.savedMessage.findMany({
    where: { employeeId },
    include: {
      message: {
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
          channel: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });
}
