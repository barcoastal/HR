import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  await requireAuth();

  const employees = await db.employee.findMany({
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
  });

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

    // Benefits eligibility events — use the actual date
    if (emp.benefitsEligibleDate) {
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Calendar</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Birthdays, work anniversaries, and benefits eligibility dates
        </p>
      </div>

      <CalendarView events={events} />
    </div>
  );
}
