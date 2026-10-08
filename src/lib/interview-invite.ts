/**
 * How a candidate's interview invitation is delivered and answered. Browser-safe (no database).
 *
 * Google Calendar sends the invitation itself whenever an event exists: that is the only invite
 * with Accept / Maybe / Decline that updates the event HR and the interviewer look at. The .ics
 * attachment on the branded email is just the fallback for when no calendar is connected — an
 * .ics sent from the company mailbox on behalf of the interviewer gives Gmail nothing to accept.
 */

export type CandidateRsvp = "accepted" | "declined" | "tentative" | "needsAction";

export const RSVP_LABEL: Record<CandidateRsvp, string> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Maybe",
  needsAction: "No response yet",
};

type GoogleAttendee = { email?: string | null; responseStatus?: string | null };

/** The candidate's response on a Google event, or null when they are not an attendee. */
export function candidateRsvp(attendees: GoogleAttendee[] | undefined | null, candidateEmail: string): CandidateRsvp | null {
  const wanted = candidateEmail.trim().toLowerCase();
  const attendee = attendees?.find((a) => (a.email ?? "").trim().toLowerCase() === wanted);
  if (!attendee) return null;
  const status = attendee.responseStatus;
  return status === "accepted" || status === "declined" || status === "tentative" ? status : "needsAction";
}

export function inviteDelivery(hasGoogleEvent: boolean): { attachIcs: boolean; candidateNote: string } {
  return hasGoogleEvent
    ? {
        attachIcs: false,
        candidateNote:
          "A Google Calendar invitation is on its way in a separate email — please accept it there so we know you're coming.",
      }
    : {
        attachIcs: true,
        candidateNote: "A calendar invitation is attached. Use your email or calendar app to accept, tentatively accept, or decline.",
      };
}
