"use server";

import { db } from "@/lib/db";

export async function getCalendarSyncStatus(userId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      googleCalendarSyncEnabled: true,
      googleCalendarAccessToken: true,
    },
  });
  return {
    connected: !!(user?.googleCalendarSyncEnabled && user?.googleCalendarAccessToken),
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpiresAt: null,
      googleCalendarSyncEnabled: false,
    },
  });
}

export async function getGoogleCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  const { fetchGoogleCalendarEvents } = await import(
    "@/lib/google-calendar-sync"
  );
  return fetchGoogleCalendarEvents(userId, timeMin, timeMax);
}

export async function toggleEmailNotifications(
  userId: string,
  enabled: boolean
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  await db.user.update({
    where: { id: userId },
    data: { emailNotificationsEnabled: enabled },
  });
}
