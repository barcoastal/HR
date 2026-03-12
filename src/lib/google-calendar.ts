import { google } from "googleapis";
import { db } from "@/lib/db";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret);
}

async function getTokens() {
  const platform = await db.recruitmentPlatform.findUnique({
    where: { name: "Google Calendar" },
  });
  if (!platform || !platform.apiKey) return null;
  return {
    accessToken: platform.apiKey,
    refreshToken: platform.refreshToken,
    expiresAt: platform.tokenExpiresAt,
    platformId: platform.id,
  };
}

export async function isCalendarConnected(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

export async function getCalendarClient() {
  const oauth2 = getOAuth2Client();
  if (!oauth2) throw new Error("Google Calendar credentials not configured");

  const tokens = await getTokens();
  if (!tokens) throw new Error("Google Calendar not connected — sign in via Settings");

  oauth2.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? undefined,
  });

  // Auto-refresh: when the token is refreshed, persist it back to the DB
  oauth2.on("tokens", async (newTokens) => {
    const update: Record<string, unknown> = {};
    if (newTokens.access_token) update.apiKey = newTokens.access_token;
    if (newTokens.refresh_token) update.refreshToken = newTokens.refresh_token;
    if (newTokens.expiry_date) update.tokenExpiresAt = new Date(newTokens.expiry_date);
    if (Object.keys(update).length > 0) {
      await db.recruitmentPlatform.update({
        where: { id: tokens.platformId },
        data: update,
      });
    }
  });

  return google.calendar({ version: "v3", auth: oauth2 });
}

export async function createInterviewEvent(params: {
  summary: string;
  description?: string;
  startTime: Date;
  durationMinutes: number;
  candidateEmail: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const calendar = await getCalendarClient();

  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      attendees: [{ email: params.candidateEmail }],
      conferenceData: {
        createRequest: {
          requestId: `interview-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  return {
    eventId: event.data.id ?? "",
    meetLink: event.data.hangoutLink ?? null,
  };
}

export async function cancelInterviewEvent(googleEventId: string): Promise<void> {
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates: "all",
  });
}
