import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { CalendarGoogleEvents } from "@/components/calendar/calendar-google-events";
import { GoogleCalendarConnect } from "@/components/calendar/google-calendar-connect";
import { getUpcomingInterviews } from "@/lib/actions/interviews";
import { getHolidaysForYear } from "@/lib/holidays";
import { displayName } from "@/lib/utils";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";
import { TrainingCalendarDialog } from "@/components/calendar/training-calendar-dialog";
import { OutOfOfficeDialog } from "@/components/time-off/out-of-office-dialog";
import { WhosOutPanel } from "@/components/calendar/whos-out-panel";
import { getVisibleOutOfOffice, getMyOutOfOffice } from "@/lib/actions/out-of-office";
import { getTrainingWorkspace, getVisibleTrainingSessions } from "@/lib/actions/training-calendar";
import { canSeeAudiencePost } from "@/lib/event-audience";
import { dateKey, formatTime, fromDateOnly, isEndOfDay, isStartOfDay, zonedDate, zonedParts } from "@/lib/time-zone";

const absenceLabels: Record<string, string> = {
  OUT_OF_OFFICE: "Out of office",
  VACATION: "Vacation / PTO",
  SICK: "Sick",
  MEDICAL_APPOINTMENT: "Doctor appointment",
  WORKING_REMOTELY: "Working remotely",
};

const oneOnOneLabels: Record<string, string> = {
  THIRTY_DAY: "30-day 1:1",
  QUARTERLY: "Quarterly 1:1",
  ANNUAL: "Annual 1:1",
};

function audienceLabel(type: string) {
  if (type === "all") return "everyone";
  if (type === "managers") return "all managers, the direct manager, and HR";
  if (type === "departments") return "selected departments, the direct manager, and HR";
  if (type === "employees") return "selected people, the direct manager, and HR";
  return "the direct manager and HR";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ oauth_error?: string; oauth_success?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const session = await requireAuth();
  const role = session.user.role;
  const userId = session.user.id;
  const callerEmployeeId = session.user.employeeId;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManagerOrAbove = isAdmin || role === "MANAGER";
  // Everything below is bucketed in the company zone, never the server's.
  const currentYear = zonedParts(new Date()).year;
  const calendarFrom = zonedDate(currentYear - 1, 0, 1);
  const calendarTo = zonedDate(currentYear + 1, 11, 31, 23, 59, 59);

  const reviewCycleWhere: Record<string, unknown> = {
    isAnniversary: true,
    status: { in: ["ACTIVE", "DRAFT"] },
  };
  if (!isAdmin) {
    if (!callerEmployeeId) reviewCycleWhere.id = "__none__";
    else if (role === "MANAGER") {
      const reports = await db.employee.findMany({ where: { managerId: callerEmployeeId }, select: { id: true } });
      reviewCycleWhere.employeeId = { in: [callerEmployeeId, ...reports.map((report) => report.id)] };
    } else reviewCycleWhere.employeeId = callerEmployeeId;
  }

  const oneOnOneWhere: Record<string, unknown> = {
    status: "SCHEDULED",
    scheduledAt: { gte: calendarFrom, lte: calendarTo },
  };
  if (!isAdmin) {
    if (!callerEmployeeId) oneOnOneWhere.id = "__none__";
    else if (role === "MANAGER") oneOnOneWhere.OR = [{ managerId: callerEmployeeId }, { employeeId: callerEmployeeId }];
    else oneOnOneWhere.employeeId = callerEmployeeId;
  }

  const [
    employees,
    interviews,
    feedEvents,
    reviewCycles,
    oneOnOnes,
    activeDirectory,
    departments,
    viewer,
    viewerEmployee,
    outOfOffice,
    myOutOfOffice,
    visibleTraining,
    trainingWorkspace,
    companySize,
  ] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, preferredName: true, email: true,
        birthday: true, anniversaryDate: true, benefitsEligibleDate: true, startDate: true,
        departmentId: true, department: { select: { name: true } },
      },
    }),
    isManagerOrAbove ? getUpcomingInterviews() : Promise.resolve([]),
    db.feedPost.findMany({
      where: { type: "EVENT", eventDate: { not: null }, eventCancelledAt: null },
      select: {
        id: true, content: true, eventDescription: true, eventDate: true, eventEndDate: true,
        eventLocation: true, eventMeetLink: true, audienceType: true, audienceDeptIds: true,
        audienceEmployeeIds: true, authorId: true,
        author: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
    db.reviewCycle.findMany({
      where: reviewCycleWhere,
      select: {
        id: true, name: true, startDate: true, endDate: true,
        employee: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
    db.oneOnOne.findMany({
      where: oneOnOneWhere,
      select: {
        id: true, scheduledAt: true, type: true, meetingLink: true,
        employee: { select: { firstName: true, lastName: true, preferredName: true } },
        manager: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, preferredName: true, email: true, departmentId: true,
        user: { select: { googleCalendarSyncEnabled: true, googleCalendarAccessToken: true, googleCalendarRefreshToken: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.department.findMany({ select: { id: true, name: true, _count: { select: { employees: true } } }, orderBy: { name: "asc" } }),
    db.user.findUnique({
      where: { id: userId },
      select: { googleCalendarSyncEnabled: true, googleCalendarAccessToken: true, googleCalendarRefreshToken: true },
    }),
    callerEmployeeId ? db.employee.findUnique({ where: { id: callerEmployeeId }, select: { departmentId: true } }) : Promise.resolve(null),
    getVisibleOutOfOffice(calendarFrom, calendarTo),
    getMyOutOfOffice(),
    getVisibleTrainingSessions(calendarFrom, calendarTo),
    getTrainingWorkspace(),
    db.employee.count({ where: { status: "ACTIVE" } }),
  ]);

  const myCalendarConnected = !!(viewer?.googleCalendarSyncEnabled && viewer.googleCalendarAccessToken && viewer.googleCalendarRefreshToken);
  const employeeNameById = new Map(employees.map((employee) => [employee.id, displayName(employee)]));
  const events: CalendarEvent[] = [];
  // Every event carries the company-zone day it belongs to so the client can
  // group without consulting the browser's zone.
  const addEvent = (event: Omit<CalendarEvent, "dateKey">) => events.push({ ...event, dateKey: dateKey(new Date(event.date)) });

  for (const employee of employees) {
    if (!isManagerOrAbove && employee.id !== callerEmployeeId) continue;
    const name = displayName(employee);
    const department = employee.department?.name || undefined;
    // Date-only columns are stored as UTC midnight, so read their calendar
    // parts with the UTC getters and pin the event to the company-zone day.
    if (employee.birthday) addEvent({ id: `bday-${employee.id}`, name, date: zonedDate(currentYear, employee.birthday.getUTCMonth(), employee.birthday.getUTCDate()).toISOString(), type: "birthday", department, allDay: true });
    if (employee.anniversaryDate) addEvent({ id: `anniv-${employee.id}`, name, date: zonedDate(currentYear, employee.anniversaryDate.getUTCMonth(), employee.anniversaryDate.getUTCDate()).toISOString(), type: "anniversary", department, years: currentYear - employee.startDate.getUTCFullYear(), allDay: true });
    if (employee.benefitsEligibleDate && isManagerOrAbove) addEvent({ id: `benefits-${employee.id}`, name, date: fromDateOnly(employee.benefitsEligibleDate).toISOString(), type: "benefits", department, allDay: true });
  }

  for (const interview of interviews) {
    const start = new Date(interview.scheduledAt);
    addEvent({
      id: `interview-${interview.id}`,
      name: `${interview.candidate.firstName} ${interview.candidate.lastName}`,
      date: start.toISOString(), type: "interview", meetLink: interview.googleMeetLink,
      location: interview.location || undefined,
      time: formatTime(start),
      description: interview.type === "ONSITE" ? "Onsite candidate interview" : "Candidate interview",
    });
  }

  // Holidays are built with the server-local `new Date(y, m, d)`; the local
  // getters round-trip that exactly, then the day is pinned to the company zone.
  for (const holiday of getHolidaysForYear(currentYear)) addEvent({
    id: `holiday-${holiday.category}-${holiday.name.replace(/\s/g, "-").toLowerCase()}`,
    name: holiday.name, date: zonedDate(holiday.date.getFullYear(), holiday.date.getMonth(), holiday.date.getDate()).toISOString(),
    type: `holiday-${holiday.category}` as CalendarEvent["type"], allDay: true,
  });

  for (const review of reviewCycles) if (review.employee) {
    const due = fromDateOnly(review.endDate).toISOString();
    addEvent({
      id: `review-${review.id}`, sourceId: review.id, sourceKind: "review",
      name: `Review: ${displayName(review.employee)}`, date: due, endDate: due,
      type: "performance-review", description: review.name, organizer: displayName(review.employee), allDay: true,
    });
  }

  for (const meeting of oneOnOnes) {
    const employeeName = displayName(meeting.employee);
    const managerName = displayName(meeting.manager);
    addEvent({
      id: `one-on-one-${meeting.id}`, sourceId: meeting.id, sourceKind: "one-on-one",
      name: `${oneOnOneLabels[meeting.type] || "1:1"}: ${employeeName}`,
      date: meeting.scheduledAt.toISOString(),
      endDate: new Date(meeting.scheduledAt.getTime() + 30 * 60_000).toISOString(),
      type: "one-on-one", meetLink: meeting.meetingLink, organizer: managerName,
      attendees: [managerName, employeeName], description: "Internal manager and employee meeting",
      time: formatTime(meeting.scheduledAt),
    });
  }

  for (const feedEvent of feedEvents) {
    if (!canSeeAudiencePost(feedEvent, { employeeId: callerEmployeeId, departmentId: viewerEmployee?.departmentId, role })) continue;
    if (!feedEvent.eventDate) continue;
    let attendeeNames: string[] = [];
    if (feedEvent.audienceType === "employees") {
      try { attendeeNames = (JSON.parse(feedEvent.audienceEmployeeIds || "[]") as string[]).map((id) => employeeNameById.get(id)).filter((name): name is string => !!name); } catch { attendeeNames = []; }
    }
    addEvent({
      id: `feed-event-${feedEvent.id}`, sourceId: feedEvent.id, sourceKind: "company",
      name: feedEvent.content, date: feedEvent.eventDate.toISOString(), endDate: feedEvent.eventEndDate?.toISOString(),
      type: "feed-event", location: feedEvent.eventLocation || undefined, description: feedEvent.eventDescription || undefined,
      meetLink: feedEvent.eventMeetLink, organizer: displayName(feedEvent.author), attendees: attendeeNames,
      audience: feedEvent.audienceType === "all" ? "everyone" : "selected attendees",
      canManage: isAdmin || feedEvent.authorId === callerEmployeeId,
      time: formatTime(feedEvent.eventDate),
    });
  }

  for (const absence of outOfOffice) {
    const employeeName = displayName(absence.employee);
    const first = zonedParts(absence.startDate);
    const lastKey = dateKey(absence.endDate);
    const allDay = isStartOfDay(absence.startDate) && isEndOfDay(absence.endDate);
    for (let index = 0; index < 366; index++) {
      // Company-zone midnight of each day the absence covers.
      const cursor = zonedDate(first.year, first.month, first.day + index);
      const cursorKey = dateKey(cursor);
      if (cursorKey > lastKey) break;
      const isFirstDay = index === 0;
      const isLastDay = cursorKey === lastKey;
      const multiDayTime = !allDay && !isFirstDay && !isLastDay
        ? "All day"
        : !allDay && !isFirstDay
          ? `Until ${formatTime(absence.endDate)}`
          : undefined;
      addEvent({
        id: `ooo-${absence.id}-${index}`, sourceId: absence.id, sourceKind: "out-of-office",
        name: `${employeeName}: ${absenceLabels[absence.type] || "Out of office"}`,
        date: (isFirstDay ? absence.startDate : cursor).toISOString(),
        endDate: absence.endDate.toISOString(), type: absence.type === "WORKING_REMOTELY" ? "working-remotely" : "out-of-office",
        description: absence.note || absenceLabels[absence.type], organizer: employeeName,
        audience: audienceLabel(absence.audienceType), allDay, time: multiDayTime,
      });
    }
  }

  for (const training of visibleTraining) addEvent({
    id: `training-${training.id}`, sourceId: training.trainingClassId, sourceKind: "training",
    name: training.title, date: training.startAt.toISOString(), endDate: training.endAt.toISOString(), type: "training",
    location: training.location || undefined, description: training.agenda || "Training session", meetLink: training.meetLink,
    organizer: training.organizer, attendees: training.attendees, groupName: training.groupName || undefined,
    canManage: training.canManage, time: formatTime(training.startAt),
  });

  const directory = activeDirectory.map((employee) => ({
    id: employee.id, firstName: employee.firstName, lastName: employee.lastName, preferredName: employee.preferredName,
    email: employee.email, departmentId: employee.departmentId,
    calendarConnected: !!(employee.user?.googleCalendarSyncEnabled && employee.user.googleCalendarAccessToken && employee.user.googleCalendarRefreshToken),
  }));
  const groupData = trainingWorkspace.groups.map((group) => ({
    id: group.id, name: group.name, description: group.description,
    members: group.members.map((member) => ({ employeeId: member.employeeId, role: member.role })),
  }));
  const classData = trainingWorkspace.classes.map((item) => ({
    id: item.id, title: item.title, agenda: item.agenda, location: item.location, organizerId: item.organizerId,
    groupId: item.groupId, attendeeEmployeeIds: item.attendeeEmployeeIds, viewerEmployeeIds: item.viewerEmployeeIds,
    rangeStart: item.rangeStart.toISOString(), rangeEnd: item.rangeEnd.toISOString(), startTime: item.startTime,
    endTime: item.endTime, weekdays: item.weekdays, withMeetLink: item.withMeetLink, status: item.status,
    sessions: item.sessions.map((trainingSession) => ({ id: trainingSession.id, startAt: trainingSession.startAt.toISOString(), endAt: trainingSession.endAt.toISOString(), status: trainingSession.status })),
    organizer: item.organizer, group: item.group,
  }));

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      {params.oauth_error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">Google Calendar connection failed: {params.oauth_error}</div>}
      {params.oauth_success && <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{params.oauth_success} connected successfully.</div>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Calendar</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">Company events, 1:1s, time away, reviews, and training in one place.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <GoogleCalendarConnect connected={myCalendarConnected} userId={userId} />
          {callerEmployeeId && <OutOfOfficeDialog
            companySize={companySize}
            departments={departments.map((department) => ({ id: department.id, name: department.name, employeeCount: department._count.employees }))}
            employees={directory}
            myDepartment={viewerEmployee?.departmentId ? { id: viewerEmployee.departmentId, name: departments.find((department) => department.id === viewerEmployee.departmentId)?.name || "My department" } : null}
            myEntries={myOutOfOffice.map((entry) => ({ id: entry.id, startDate: entry.startDate, endDate: entry.endDate, type: entry.type, note: entry.note, audienceType: entry.audienceType }))}
          />}
          {isManagerOrAbove && <>
            <TrainingCalendarDialog employees={directory} groups={groupData} classes={classData} />
            <CreateEventDialog
              departments={departments.map((department) => ({ id: department.id, name: department.name, employeeCount: department._count.employees }))}
              employees={directory}
              trainingGroups={groupData.map((group) => ({ id: group.id, name: group.name, employeeIds: [...new Set(group.members.filter((member) => member.role !== "VIEWER").map((member) => member.employeeId))] }))}
            />
          </>}
        </div>
      </div>
      <div className="mb-6"><WhosOutPanel entries={outOfOffice} /></div>
      {myCalendarConnected ? <CalendarGoogleEvents events={events} userId={userId} /> : <CalendarView events={events} />}
    </div>
  );
}
