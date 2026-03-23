import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";

// ── Types ──────────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
};

// ── Token refresh (per-user mutex) ─────────────────────────

const refreshLocks = new Map<string, Promise<void>>();

async function ensureValidToken(
  userId: string
): Promise<{ accessToken: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      googleCalendarAccessToken: true,
      googleCalendarRefreshToken: true,
      googleCalendarTokenExpiresAt: true,
      googleCalendarSyncEnabled: true,
    },
  });

  if (
    !user ||
    !user.googleCalendarSyncEnabled ||
    !user.googleCalendarAccessToken ||
    !user.googleCalendarRefreshToken
  ) {
    throw new Error("Google Calendar is not connected");
  }

  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  const expiresAt = user.googleCalendarTokenExpiresAt ?? new Date(0);

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: decrypt(user.googleCalendarAccessToken) };
  }

  // Deduplicate concurrent refresh calls per user
  if (!refreshLocks.has(userId)) {
    const promise = (async () => {
      try {
        const provider = getOAuthProvider("google_calendar");
        const creds = provider ? getOAuthCredentials(provider) : null;
        if (!provider || !creds) throw new Error("Google Calendar OAuth not configured");

        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decrypt(user.googleCalendarRefreshToken!),
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        });

        const res = await fetch(provider.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        if (!res.ok) {
          await db.user.update({
            where: { id: userId },
            data: { googleCalendarSyncEnabled: false },
          });
          throw new Error("Google Calendar token refresh failed");
        }

        const tokens = await res.json();
        await db.user.update({
          where: { id: userId },
          data: {
            googleCalendarAccessToken: encrypt(tokens.access_token),
            ...(tokens.refresh_token
              ? { googleCalendarRefreshToken: encrypt(tokens.refresh_token) }
              : {}),
            googleCalendarTokenExpiresAt: new Date(
              Date.now() + (tokens.expires_in ?? 3600) * 1000
            ),
          },
        });
      } finally {
        refreshLocks.delete(userId);
      }
    })();
    refreshLocks.set(userId, promise);
  }

  await refreshLocks.get(userId);

  const refreshed = await db.user.findUnique({
    where: { id: userId },
    select: { googleCalendarAccessToken: true },
  });
  if (!refreshed?.googleCalendarAccessToken) {
    throw new Error("Token refresh failed");
  }
  return { accessToken: decrypt(refreshed.googleCalendarAccessToken) };
}

// ── API helpers ────────────────────────────────────────────

async function googleFetch<T>(
  userId: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const { accessToken } = await ensureValidToken(userId);
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Public API ─────────────────────────────────────────────

export async function fetchGoogleCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const data = await googleFetch<{ items?: GoogleCalendarEvent[] }>(
    userId,
    `/calendars/primary/events?${params}`
  );

  return data.items ?? [];
}

export async function pushEventToGoogleCalendar(
  userId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string;
    endDateTime: string;
  }
): Promise<string> {
  const created = await googleFetch<{ id: string }>(
    userId,
    "/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startDateTime },
        end: { dateTime: event.endDateTime },
      }),
    }
  );
  return created.id;
}

export async function deleteEventFromGoogleCalendar(
  userId: string,
  googleEventId: string
): Promise<void> {
  const { accessToken } = await ensureValidToken(userId);
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

// ── OAuth callback handler ─────────────────────────────────

export async function handleGoogleCalendarCallback(
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  },
  context: { userId: string }
): Promise<void> {
  await db.user.update({
    where: { id: context.userId },
    data: {
      googleCalendarAccessToken: encrypt(tokens.access_token),
      googleCalendarRefreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : undefined,
      googleCalendarTokenExpiresAt: new Date(
        Date.now() + (tokens.expires_in ?? 3600) * 1000
      ),
      googleCalendarSyncEnabled: true,
    },
  });
}
