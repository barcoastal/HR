import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getUpcomingInterviews } from "@/lib/actions/interviews";
import { getHolidaysForYear } from "@/lib/holidays";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";

export default async function CalendarPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const userId = session.user?.id;
  const callerEmployeeId = session.user?.employeeId;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManagerOrAbove = isAdmin || role === "MANAGER";

  // Anniversary reviews are personal — scope them to admin/HR (all), manager
  // (their direct reports + themselves), or the employee (themselves only).
  const reviewCycleWhere: Record<string, unknown> = {
    isAnniversary: true,
    status: { in: ["ACTIVE", "DRAFT"] },
  };
  if (!isAdmin) {
    if (!callerEmployeeId) {
      reviewCycleWhere.id = "__none__";
    } else if (role === "MANAGER") {
      const reports = await db.employee.findMany({
        where: { managerId: callerEmployeeId },
        select: { id: true },
      });
      reviewCycleWhere.employeeId = {
        in: [callerEmployeeId, ...reports.map((r) => r.id)],
      };
    } else {
      reviewCycleWhere.employeeId = callerEmployeeId;
    }
  }

  const [employees, interviews, feedEvents, reviewCycles, allActiveEmployees, departments] = await Promise.all([
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
    db.reviewCycle.findMany({
      where: reviewCycleWhere,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    isManagerOrAbove
      ? db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } })
      : Promise.resolve([]),
    isManagerOrAbove
      ? db.department.findMany({ select: { id: true, name: true, _count: { select: { employees: true } } }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
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

  // Performance review events
  for (const rc of reviewCycles) {
    if (rc.employee) {
      events.push({
        id: `review-${rc.id}`,
        name: `Review: ${rc.employee.firstName} ${rc.employee.lastName}`,
        date: rc.endDate.toISOString(),
        type: "performance-review" as CalendarEvent["type"],
      });
    }
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
        {isManagerOrAbove && (
          <CreateEventDialog
            departments={departments.map((d) => ({ id: d.id, name: d.name, employeeCount: d._count.employees }))}
            employees={allActiveEmployees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, departmentId: e.departmentId }))}
          />
        )}
      </div>
      <CalendarView events={events} />
    </div>
  );
}
