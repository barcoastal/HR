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
  const now = new Date();
  const currentYear = now.getFullYear();
  const calendarFrom = new Date(currentYear - 1, 0, 1);
  const calendarTo = new Date(currentYear + 1, 11, 31, 23, 59, 59);

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

  for (const employee of employees) {
    if (!isManagerOrAbove && employee.id !== callerEmployeeId) continue;
    const name = displayName(employee);
    const department = employee.department?.name || undefined;
    if (employee.birthday) events.push({ id: `bday-${employee.id}`, name, date: new Date(currentYear, employee.birthday.getMonth(), employee.birthday.getDate()).toISOString(), type: "birthday", department, allDay: true });
    if (employee.anniversaryDate) events.push({ id: `anniv-${employee.id}`, name, date: new Date(currentYear, employee.anniversaryDate.getMonth(), employee.anniversaryDate.getDate()).toISOString(), type: "anniversary", department, years: currentYear - employee.startDate.getFullYear(), allDay: true });
    if (employee.benefitsEligibleDate && isManagerOrAbove) events.push({ id: `benefits-${employee.id}`, name, date: employee.benefitsEligibleDate.toISOString(), type: "benefits", department, allDay: true });
  }

  for (const interview of interviews) {
    const start = new Date(interview.scheduledAt);
    events.push({
      id: `interview-${interview.id}`,
      name: `${interview.candidate.firstName} ${interview.candidate.lastName}`,
      date: start.toISOString(), type: "interview", meetLink: interview.googleMeetLink,
      time: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      description: "Candidate interview",
    });
  }

  for (const holiday of getHolidaysForYear(currentYear)) events.push({
    id: `holiday-${holiday.category}-${holiday.name.replace(/\s/g, "-").toLowerCase()}`,
    name: holiday.name, date: holiday.date.toISOString(), type: `holiday-${holiday.category}` as CalendarEvent["type"], allDay: true,
  });

  for (const review of reviewCycles) if (review.employee) events.push({
    id: `review-${review.id}`, sourceId: review.id, sourceKind: "review",
    name: `Review: ${displayName(review.employee)}`, date: review.endDate.toISOString(), endDate: review.endDate.toISOString(),
    type: "performance-review", description: review.name, organizer: displayName(review.employee), allDay: true,
  });

  for (const meeting of oneOnOnes) {
    const employeeName = displayName(meeting.employee);
    const managerName = displayName(meeting.manager);
    events.push({
      id: `one-on-one-${meeting.id}`, sourceId: meeting.id, sourceKind: "one-on-one",
      name: `${oneOnOneLabels[meeting.type] || "1:1"}: ${employeeName}`,
      date: meeting.scheduledAt.toISOString(),
      endDate: new Date(meeting.scheduledAt.getTime() + 30 * 60_000).toISOString(),
      type: "one-on-one", meetLink: meeting.meetingLink, organizer: managerName,
      attendees: [managerName, employeeName], description: "Internal manager and employee meeting",
      time: meeting.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }

  for (const feedEvent of feedEvents) {
    if (!canSeeAudiencePost(feedEvent, { employeeId: callerEmployeeId, departmentId: viewerEmployee?.departmentId, role })) continue;
    if (!feedEvent.eventDate) continue;
    let attendeeNames: string[] = [];
    if (feedEvent.audienceType === "employees") {
      try { attendeeNames = (JSON.parse(feedEvent.audienceEmployeeIds || "[]") as string[]).map((id) => employeeNameById.get(id)).filter((name): name is string => !!name); } catch { attendeeNames = []; }
    }
    events.push({
      id: `feed-event-${feedEvent.id}`, sourceId: feedEvent.id, sourceKind: "company",
      name: feedEvent.content, date: feedEvent.eventDate.toISOString(), endDate: feedEvent.eventEndDate?.toISOString(),
      type: "feed-event", location: feedEvent.eventLocation || undefined, description: feedEvent.eventDescription || undefined,
      meetLink: feedEvent.eventMeetLink, organizer: displayName(feedEvent.author), attendees: attendeeNames,
      audience: feedEvent.audienceType === "all" ? "everyone" : "selected attendees",
      canManage: isAdmin || feedEvent.authorId === callerEmployeeId,
      time: feedEvent.eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }

  for (const absence of outOfOffice) {
    const employeeName = displayName(absence.employee);
    const cursor = new Date(absence.startDate.getFullYear(), absence.startDate.getMonth(), absence.startDate.getDate());
    const last = new Date(absence.endDate.getFullYear(), absence.endDate.getMonth(), absence.endDate.getDate());
    const allDay = absence.startDate.getHours() === 0 && absence.startDate.getMinutes() === 0 && absence.endDate.getHours() === 23;
    let index = 0;
    while (cursor <= last && index < 366) {
      const isFirstDay = index === 0;
      const isLastDay = cursor.toDateString() === last.toDateString();
      const multiDayTime = !allDay && !isFirstDay && !isLastDay
        ? "All day"
        : !allDay && !isFirstDay
          ? `Until ${absence.endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
          : undefined;
      events.push({
        id: `ooo-${absence.id}-${index}`, sourceId: absence.id, sourceKind: "out-of-office",
        name: `${employeeName}: ${absenceLabels[absence.type] || "Out of office"}`,
        date: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), index === 0 ? absence.startDate.getHours() : 0, index === 0 ? absence.startDate.getMinutes() : 0).toISOString(),
        endDate: absence.endDate.toISOString(), type: absence.type === "WORKING_REMOTELY" ? "working-remotely" : "out-of-office",
        description: absence.note || absenceLabels[absence.type], organizer: employeeName,
        audience: audienceLabel(absence.audienceType), allDay, time: multiDayTime,
      });
      cursor.setDate(cursor.getDate() + 1); index++;
    }
  }

  for (const training of visibleTraining) events.push({
    id: `training-${training.id}`, sourceId: training.trainingClassId, sourceKind: "training",
    name: training.title, date: training.startAt.toISOString(), endDate: training.endAt.toISOString(), type: "training",
    location: training.location || undefined, description: training.agenda || "Training session", meetLink: training.meetLink,
    organizer: training.organizer, attendees: training.attendees, groupName: training.groupName || undefined,
    canManage: training.canManage, time: training.startAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
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
