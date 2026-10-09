/**
 * Who has answered an invitation, combining Google's attendee responses with answers given
 * inside the app. Browser-safe (no database).
 *
 * Google Calendar's own invitation is the one people answer with a single click in their
 * email; accepting puts the event on their calendar and Google emails the organizer. The
 * app reads the answers back off the organizer's event and shows them next to each name.
 */

export type EventResponse = "accepted" | "declined" | "tentative" | "needsAction";

export const RESPONSE_LABEL: Record<EventResponse, string> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Maybe",
  needsAction: "No response yet",
};

export type InAppAnswer = "GOING" | "MAYBE" | "NOT_GOING";

export type AttendeeResponse = {
  email: string;
  name: string;
  response: EventResponse;
};

export type GoogleAttendee = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
};

/** Google's responseStatus narrowed to the four values we show. */
export function responseFromGoogle(status: string | null | undefined): EventResponse {
  return status === "accepted" || status === "declined" || status === "tentative" ? status : "needsAction";
}

/** What an in-app Going / Maybe / Not going click means on the Google event. */
export function googleStatusForAnswer(answer: InAppAnswer): EventResponse {
  return answer === "GOING" ? "accepted" : answer === "MAYBE" ? "tentative" : "declined";
}

/**
 * One row per invitee. A Google answer wins; an in-app answer fills in when Google has
 * none (or the event has no Google copy); otherwise the person hasn't responded.
 */
export function attendeeResponses(opts: {
  invitees: { email: string; name: string }[];
  googleAttendees?: GoogleAttendee[] | null;
  inApp?: Record<string, InAppAnswer>;
}): AttendeeResponse[] {
  const google = new Map<string, EventResponse>();
  for (const a of opts.googleAttendees ?? []) {
    const email = a.email?.trim().toLowerCase();
    if (email) google.set(email, responseFromGoogle(a.responseStatus));
  }
  const inApp = new Map<string, InAppAnswer>();
  for (const [email, answer] of Object.entries(opts.inApp ?? {})) inApp.set(email.trim().toLowerCase(), answer);

  return opts.invitees.map((invitee) => {
    const email = invitee.email.trim().toLowerCase();
    const fromGoogle = google.get(email);
    const fromApp = inApp.get(email);
    const response =
      fromGoogle && fromGoogle !== "needsAction"
        ? fromGoogle
        : fromApp
          ? googleStatusForAnswer(fromApp)
          : "needsAction";
    return { email: invitee.email, name: invitee.name, response };
  });
}

export function responseCounts(rows: AttendeeResponse[]): Record<EventResponse, number> {
  const counts: Record<EventResponse, number> = { accepted: 0, declined: 0, tentative: 0, needsAction: 0 };
  for (const r of rows) counts[r.response]++;
  return counts;
}
