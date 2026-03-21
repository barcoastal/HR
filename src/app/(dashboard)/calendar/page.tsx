import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getUpcomingInterviews } from "@/lib/actions/interviews";
import { getHolidaysForYear } from "@/lib/holidays";

export default async function CalendarPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isManagerOrAbove = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";

  const [employees, interviews] = await Promise.all([
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
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const events: CalendarEvent[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const department = emp.department?.name || undefined;

    // Birthday events — set year to current year, keep month/day
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

    // Anniversary events — set year to current year, keep month/day, calculate years
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

    // Benefits eligibility events — HR/admin only
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

  // Interview events
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

  // Holidays (Jewish, Muslim, Christian, American)
  const holidays = getHolidaysForYear(currentYear);
  for (const h of holidays) {
    events.push({
      id: `holiday-${h.category}-${h.name.replace(/\s/g, "-").toLowerCase()}`,
      name: h.name,
      date: h.date.toISOString(),
      type: `holiday-${h.category}` as CalendarEvent["type"],
    });
  }

  return (
    <div className="px-8 py-8">
      <CalendarView events={events} />
    </div>
  );
}
