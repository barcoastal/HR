// Minimal RFC 5545 ICS generator for calendar invites.
// Produces a single-event VCALENDAR with METHOD:REQUEST so Gmail/Outlook/Apple
// recognize it as a meeting invite.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcsInvite(input: {
  uid: string;
  start: Date;
  durationMinutes: number;
  summary: string;
  description?: string;
  location?: string;
  organizerEmail: string;
  organizerName?: string;
  attendees: { email: string; name?: string }[];
  sequence?: number;
  cancelled?: boolean;
}): Buffer {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
  const dtStamp = formatUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CALATRAVA HR//1on1 Invite//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatUtc(input.start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    input.description ? `DESCRIPTION:${escapeText(input.description)}` : "",
    input.location ? `LOCATION:${escapeText(input.location)}` : "",
    `ORGANIZER;CN=${escapeText(input.organizerName || input.organizerEmail)}:mailto:${input.organizerEmail}`,
    ...input.attendees.map(
      (a) =>
        `ATTENDEE;CN=${escapeText(a.name || a.email)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${a.email}`
    ),
    `SEQUENCE:${input.sequence ?? 0}`,
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return Buffer.from(lines.join("\r\n"));
}
