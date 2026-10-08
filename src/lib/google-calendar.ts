import { google } from "googleapis";
import { db } from "@/lib/db";
import { IS_SANDBOX } from "@/lib/sandbox";
import { COMPANY_TIME_ZONE } from "@/lib/time-zone";
import { candidateRsvp, type CandidateRsvp } from "@/lib/interview-invite";

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
  // Sandbox pretends the calendar is connected so scheduling flows are
  // testable end-to-end; events are simulated in createInterviewEvent.
  if (IS_SANDBOX) return true;
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
  location?: string;
  startTime: Date;
  durationMinutes: number;
  candidateEmail: string;
  /** Attach a Google Meet conference. Defaults to true; onsite interviews pass false. */
  withMeetLink?: boolean;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const withMeetLink = params.withMeetLink !== false;
  if (IS_SANDBOX) {
    console.log(`[sandbox] calendar event simulated: ${params.summary}`);
    return {
      eventId: `sandbox-${Date.now()}`,
      meetLink: withMeetLink ? "https://meet.google.com/sandbox-demo-link" : null,
    };
  }
  const calendar = await getCalendarClient();

  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    ...(withMeetLink ? { conferenceDataVersion: 1 } : {}),
    // Google mails the candidate its own invitation: the only one whose Accept / Decline
    // updates this event. (An .ics sent from the company mailbox gave Gmail nothing to accept,
    // and the responses never reached this calendar.) The branded email carries the details.
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: { dateTime: params.startTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
      end: { dateTime: endTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
      attendees: [{ email: params.candidateEmail }],
      ...(withMeetLink
        ? {
            conferenceData: {
              createRequest: {
                requestId: `interview-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    },
  });

  return {
    eventId: event.data.id ?? "",
    meetLink: event.data.hangoutLink ?? null,
  };
}

/** The candidate's answer to the Google invitation, or null when they are not on the event. */
export async function getInterviewEventResponse(googleEventId: string, candidateEmail: string): Promise<CandidateRsvp | null> {
  if (IS_SANDBOX) return "needsAction";
  const calendar = await getCalendarClient();
  const { data } = await calendar.events.get({ calendarId: "primary", eventId: googleEventId });
  return candidateRsvp(data.attendees, candidateEmail);
}

/**
 * Make Google send the candidate a fresh invitation for an existing event. Google only mails
 * attendees it has news for, so the candidate is taken off the event silently and put back.
 */
export async function resendInterviewEventInvite(googleEventId: string, candidateEmail: string): Promise<void> {
  if (IS_SANDBOX) {
    console.log(`[sandbox] calendar invitation re-sent to ${candidateEmail}`);
    return;
  }
  const calendar = await getCalendarClient();
  const { data } = await calendar.events.get({ calendarId: "primary", eventId: googleEventId });
  const wanted = candidateEmail.trim().toLowerCase();
  const others = (data.attendees ?? []).filter((a) => (a.email ?? "").trim().toLowerCase() !== wanted);
  await calendar.events.patch({ calendarId: "primary", eventId: googleEventId, sendUpdates: "none", requestBody: { attendees: others } });
  await calendar.events.patch({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates: "all",
    requestBody: { attendees: [...others, { email: candidateEmail }] },
  });
}

export async function cancelInterviewEvent(googleEventId: string): Promise<void> {
  if (IS_SANDBOX) return;
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates: "all",
  });
}

export async function createOneOnOneEvent(params: {
  summary: string;
  description?: string;
  startTime: Date;
  durationMinutes: number;
  managerEmail: string;
  employeeEmail: string;
  oneOnOneId: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  if (IS_SANDBOX) {
    console.log(`[sandbox] 1:1 calendar event simulated: ${params.summary}`);
    return { eventId: `sandbox-${Date.now()}`, meetLink: "https://meet.google.com/sandbox-demo-link" };
  }
  const calendar = await getCalendarClient();
  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
      end: { dateTime: endTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
      attendees: [
        { email: params.managerEmail, responseStatus: "accepted" },
        { email: params.employeeEmail },
      ],
      conferenceData: {
        createRequest: {
          requestId: `one-on-one-${params.oneOnOneId}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: { useDefault: true },
    },
  });

  return {
    eventId: event.data.id ?? "",
    meetLink: event.data.hangoutLink ?? null,
  };
}

export async function updateOneOnOneEvent(params: {
  googleEventId: string;
  startTime: Date;
  durationMinutes: number;
}): Promise<void> {
  if (IS_SANDBOX) return;
  const calendar = await getCalendarClient();
  const endTime = new Date(params.startTime.getTime() + params.durationMinutes * 60 * 1000);
  await calendar.events.patch({
    calendarId: "primary",
    eventId: params.googleEventId,
    sendUpdates: "all",
    requestBody: {
      start: { dateTime: params.startTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
      end: { dateTime: endTime.toISOString(), timeZone: COMPANY_TIME_ZONE },
    },
  });
}

export async function cancelOneOnOneEvent(googleEventId: string): Promise<void> {
  if (IS_SANDBOX) return;
  const calendar = await getCalendarClient();
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates: "all",
  });
}
