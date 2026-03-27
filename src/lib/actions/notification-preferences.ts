"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type NotificationPreferences = {
  emailNotificationsEnabled: boolean;
  notifyFeedPostEmail: boolean;
  notifyFeedPostInApp: boolean;
  notifyFeedEventEmail: boolean;
  notifyFeedEventInApp: boolean;
  notifyCommentEmail: boolean;
  notifyCommentInApp: boolean;
  notifyReactionInApp: boolean;
  notifyShoutoutEmail: boolean;
  notifyShoutoutInApp: boolean;
  notifyPromotionEmail: boolean;
  notifyPromotionInApp: boolean;
};

const PREFERENCE_FIELDS = [
  "emailNotificationsEnabled",
  "notifyFeedPostEmail",
  "notifyFeedPostInApp",
  "notifyFeedEventEmail",
  "notifyFeedEventInApp",
  "notifyCommentEmail",
  "notifyCommentInApp",
  "notifyReactionInApp",
  "notifyShoutoutEmail",
  "notifyShoutoutInApp",
  "notifyPromotionEmail",
  "notifyPromotionInApp",
] as const;

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      emailNotificationsEnabled: true,
      notifyFeedPostEmail: true,
      notifyFeedPostInApp: true,
      notifyFeedEventEmail: true,
      notifyFeedEventInApp: true,
      notifyCommentEmail: true,
      notifyCommentInApp: true,
      notifyReactionInApp: true,
      notifyShoutoutEmail: true,
      notifyShoutoutInApp: true,
      notifyPromotionEmail: true,
      notifyPromotionInApp: true,
    },
  });
  if (!user) {
    return {
      emailNotificationsEnabled: true,
      notifyFeedPostEmail: true,
      notifyFeedPostInApp: true,
      notifyFeedEventEmail: true,
      notifyFeedEventInApp: true,
      notifyCommentEmail: true,
      notifyCommentInApp: true,
      notifyReactionInApp: true,
      notifyShoutoutEmail: true,
      notifyShoutoutInApp: true,
      notifyPromotionEmail: true,
      notifyPromotionInApp: true,
    };
  }
  return user;
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  // Only allow known fields
  const data: Record<string, boolean> = {};
  for (const key of PREFERENCE_FIELDS) {
    if (key in prefs) {
      data[key] = !!prefs[key];
    }
  }

  await db.user.update({
    where: { id: userId },
    data,
  });

  revalidatePath("/my-profile");
}
