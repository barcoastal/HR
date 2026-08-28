"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getGoogleCalendarEvents } from "@/lib/actions/calendar-sync";
import { dateKey, formatTime, zonedDate, zonedDateFromInput, zonedParts } from "@/lib/time-zone";

export function CalendarGoogleEvents({
  events: serverEvents,
  userId,
}: {
  events: CalendarEvent[];
  userId: string;
}) {
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    // Previous month through the end of next month, in company-zone days.
    const today = zonedParts(new Date());
    const timeMin = zonedDate(today.year, today.month - 1, 1).toISOString();
    const timeMax = zonedDate(today.year, today.month + 2, 0).toISOString();

    getGoogleCalendarEvents(userId, timeMin, timeMax)
      .then((events) => {
        setGoogleEvents(
          events.flatMap((ge) => {
            // Timed events carry an instant; all-day events carry a plain
            // calendar date, which is pinned to company-zone midnight so it
            // files under that day rather than the evening before.
            const start = ge.start.dateTime ? new Date(ge.start.dateTime) : zonedDateFromInput(ge.start.date || "");
            if (!start || Number.isNaN(start.getTime())) return [];
            return [{
              id: `gcal-${ge.id}`,
              name: ge.summary || "Untitled",
              date: start.toISOString(),
              dateKey: dateKey(start),
              type: "google-calendar" as const,
              endDate: ge.end.dateTime || ge.end.date || undefined,
              location: ge.location || undefined,
              description: ge.description || undefined,
              meetLink: ge.hangoutLink || null,
              htmlLink: ge.htmlLink || null,
              organizer: ge.organizer?.displayName || ge.organizer?.email,
              attendees: ge.attendees
                ?.filter((attendee) => !attendee.self)
                .map((attendee) => attendee.displayName || attendee.email)
                .filter((name): name is string => !!name),
              allDay: !ge.start.dateTime,
              sourceId: ge.id,
              sourceKind: "google" as const,
              time: ge.start.dateTime ? formatTime(start) : undefined,
            }];
          })
        );
      })
      .catch((err) => {
        console.error("Failed to fetch Google Calendar events:", err);
        setError("Failed to load Google Calendar events");
      });
  }, [userId]);

  const allEvents = [...serverEvents, ...googleEvents];

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">
          {error}
        </div>
      )}
      <CalendarView events={allEvents} />
    </div>
  );
}
