"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getGoogleCalendarEvents } from "@/lib/actions/calendar-sync";

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

    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    getGoogleCalendarEvents(userId, timeMin, timeMax)
      .then((events) => {
        setGoogleEvents(
          events.map((ge) => ({
            id: `gcal-${ge.id}`,
            name: ge.summary || "Untitled",
            date: ge.start.dateTime || ge.start.date || "",
            type: "google-calendar" as const,
            endDate: ge.end.dateTime || ge.end.date || undefined,
            location: ge.location || undefined,
          }))
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
