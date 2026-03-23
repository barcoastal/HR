import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getUpcomingInterviews } from "@/lib/actions/interviews";
import { getHolidaysForYear } from "@/lib/holidays";
import { getCalendarSyncStatus } from "@/lib/actions/calendar-sync";
import { GoogleCalendarConnect } from "@/components/calendar/google-calendar-connect";
import { CalendarGoogleEvents } from "@/components/calendar/calendar-google-events";

export default async function CalendarPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const userId = session.user?.id;
  const isManagerOrAbove = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";

  const [employees, interviews, syncStatus, feedEvents] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthday: true,
        anniversaryDate: true,
        benefitsEligibleDate: true,
        startDate: true,
        department: { select: { name: true } },
      },
    }),
    isManagerOrAbove ? getUpcomingInterviews() : Promise.resolve([]),
    userId ? getCalendarSyncStatus(userId) : { connected: false },
    db.feedPost.findMany({
      where: { type: "EVENT", eventDate: { not: null } },
      select: {
        id: true,
        content: true,
        eventDate: true,
        eventEndDate: true,
        eventLocation: true,
      },
    }),
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const events: CalendarEvent[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const department = emp.department?.name || undefined;

    if (emp.birthday) {
      const bd = emp.birthday;
      events.push({
        id: `bday-${emp.id}`,
        name,
        date: new Date(currentYear, bd.getMonth(), bd.getDate()).toISOString(),
        type: "birthday",
        department,
      });
    }

    if (emp.anniversaryDate) {
      const ad = emp.anniversaryDate;
      const years = currentYear - emp.startDate.getFullYear();
      events.push({
        id: `anniv-${emp.id}`,
        name,
        date: new Date(currentYear, ad.getMonth(), ad.getDate()).toISOString(),
        type: "anniversary",
        department,
        years,
      });
    }

    if (emp.benefitsEligibleDate && isManagerOrAbove) {
      const bed = emp.benefitsEligibleDate;
      events.push({
        id: `benefits-${emp.id}`,
        name,
        date: new Date(bed.getFullYear(), bed.getMonth(), bed.getDate()).toISOString(),
        type: "benefits",
        department,
      });
    }
  }

  for (const interview of interviews) {
    const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`;
    const d = new Date(interview.scheduledAt);
    events.push({
      id: `interview-${interview.id}`,
      name: candidateName,
      date: d.toISOString(),
      type: "interview",
      meetLink: interview.googleMeetLink,
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }

  const holidays = getHolidaysForYear(currentYear);
  for (const h of holidays) {
    events.push({
      id: `holiday-${h.category}-${h.name.replace(/\s/g, "-").toLowerCase()}`,
      name: h.name,
      date: h.date.toISOString(),
      type: `holiday-${h.category}` as CalendarEvent["type"],
    });
  }

  // Feed events
  for (const fe of feedEvents) {
    if (fe.eventDate) {
      events.push({
        id: `feed-event-${fe.id}`,
        name: fe.content.slice(0, 80),
        date: fe.eventDate.toISOString(),
        type: "feed-event",
        endDate: fe.eventEndDate?.toISOString(),
        location: fe.eventLocation || undefined,
      });
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Calendar</h1>
        {userId && (
          <GoogleCalendarConnect connected={syncStatus.connected} userId={userId} />
        )}
      </div>
      {syncStatus.connected && userId ? (
        <CalendarGoogleEvents
          events={events}
          userId={userId}
        />
      ) : (
        <CalendarView events={events} />
      )}
    </div>
  );
}
