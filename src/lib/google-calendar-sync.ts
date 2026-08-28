import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";
import { COMPANY_TIME_ZONE } from "@/lib/time-zone";

// ── Types ──────────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; self?: boolean }[];
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

async function fetchGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google account lookup failed ${res.status}: ${text}`);
  }
  const profile = (await res.json()) as { email?: string };
  if (!profile.email) throw new Error("Google account did not return an email address");
  return profile.email.trim().toLowerCase();
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

export async function getConnectedGoogleAccountEmail(userId: string): Promise<string> {
  const { accessToken } = await ensureValidToken(userId);
  return fetchGoogleAccountEmail(accessToken);
}

export async function assertConnectedGoogleAccount(
  userId: string,
  expectedEmail: string
): Promise<void> {
  const connectedEmail = await getConnectedGoogleAccountEmail(userId);
  if (connectedEmail !== expectedEmail.trim().toLowerCase()) {
    await db.user.update({
      where: { id: userId },
      data: { googleCalendarSyncEnabled: false },
    });
    throw new Error(
      `Connected Google account ${connectedEmail} does not match ${expectedEmail.trim().toLowerCase()}`
    );
  }
}

/**
 * Create a 1:1 calendar event on the manager's *own* primary calendar — that
 * way the manager is the organizer (instead of whoever connected the platform-
 * wide Google Calendar in Settings). Includes the employee as an attendee and
 * a Google Meet link. Returns null if the manager hasn't connected their own
 * calendar — callers should fall back to the shared connection.
 */
export async function createOneOnOneEventForUser(
  userId: string,
  params: {
    summary: string;
    description?: string;
    startTime: Date;
    durationMinutes: number;
    employeeEmail: string;
    oneOnOneId: string;
  },
): Promise<{ eventId: string; meetLink: string | null }> {
  const { accessToken } = await ensureValidToken(userId);
  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const body = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
    end: { dateTime: endTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
    attendees: [{ email: params.employeeEmail }],
    conferenceData: {
      createRequest: {
        requestId: `one-on-one-${params.oneOnOneId}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id?: string; hangoutLink?: string };
  return { eventId: data.id ?? "", meetLink: data.hangoutLink ?? null };
}

/**
 * Create an invite-style event (attendees, optional Meet link) on the
 * creator's *own* primary calendar so the invite comes from them instead of
 * whoever connected the platform-wide Google Calendar in Settings. Throws if
 * the user hasn't connected their calendar — callers fall back to the shared
 * connection.
 */
export async function createInviteEventForUser(
  userId: string,
  params: {
    summary: string;
    description?: string;
    location?: string;
    startTime: Date;
    durationMinutes: number;
    attendees: { email: string; displayName?: string }[];
    withMeetLink?: boolean;
    sendUpdates?: "all" | "none";
  }
): Promise<{ eventId: string; meetLink: string | null }> {
  const { accessToken } = await ensureValidToken(userId);
  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: { dateTime: params.startTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
    end: { dateTime: endTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
    attendees: params.attendees,
    reminders: { useDefault: true },
  };
  if (params.withMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: `company-event-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const sendUpdates = params.sendUpdates || "all";
  const qs = params.withMeetLink
    ? `conferenceDataVersion=1&sendUpdates=${sendUpdates}`
    : `sendUpdates=${sendUpdates}`;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id?: string; hangoutLink?: string };
  return { eventId: data.id ?? "", meetLink: data.hangoutLink ?? null };
}

export async function patchEventAttendeesForUser(
  userId: string,
  eventId: string,
  attendees: { email: string; displayName?: string }[]
): Promise<void> {
  const { accessToken } = await ensureValidToken(userId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ attendees }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
}

export async function updateInviteEventForUser(
  userId: string,
  eventId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: { email: string; displayName?: string }[];
  }
): Promise<void> {
  await googleFetch<Record<string, unknown>>(
    userId,
    `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startDateTime, timeZone: COMPANY_TIME_ZONE },
        end: { dateTime: event.endDateTime, timeZone: COMPANY_TIME_ZONE },
        ...(event.attendees ? { attendees: event.attendees } : {}),
      }),
    }
  );
}

export async function updateStandaloneEventForUser(
  userId: string,
  eventId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string;
    endDateTime: string;
  }
): Promise<void> {
  await googleFetch<Record<string, unknown>>(
    userId,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startDateTime, timeZone: COMPANY_TIME_ZONE },
        end: { dateTime: event.endDateTime, timeZone: COMPANY_TIME_ZONE },
      }),
    }
  );
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
        start: { dateTime: event.startDateTime, timeZone: COMPANY_TIME_ZONE },
        end: { dateTime: event.endDateTime, timeZone: COMPANY_TIME_ZONE },
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
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }
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
  const user = await db.user.findUnique({
    where: { id: context.userId },
    select: { email: true, employee: { select: { email: true } } },
  });
  if (!user) throw new Error("HRIS user was not found");

  const expectedEmail = (user.employee?.email || user.email).trim().toLowerCase();
  const connectedEmail = await fetchGoogleAccountEmail(tokens.access_token);
  if (connectedEmail !== expectedEmail) {
    await db.user.update({
      where: { id: context.userId },
      data: { googleCalendarSyncEnabled: false },
    });
    throw new Error(
      `The selected Google account (${connectedEmail}) does not match your HRIS email (${expectedEmail}). Choose the matching Google account.`
    );
  }

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
