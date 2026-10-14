// Review milestones: the 30/60/90-day, quarterly and yearly reviews every
// active employee is due, computed from their start date. Pure date-key
// arithmetic so the same logic runs on the calendar, in the daily reminder
// job and in tests without touching the database or the server's zone.

export const MILESTONE_KINDS = ["THIRTY_DAY", "SIXTY_DAY", "NINETY_DAY", "QUARTERLY", "YEARLY"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  THIRTY_DAY: "30-day review",
  SIXTY_DAY: "60-day review",
  NINETY_DAY: "90-day review",
  QUARTERLY: "Quarterly review",
  YEARLY: "Yearly review",
};

/** The 1:1 meeting type created when a milestone is scheduled. */
export const MILESTONE_MEETING_TYPE: Record<MilestoneKind, "THIRTY_DAY" | "SIXTY_DAY" | "NINETY_DAY" | "QUARTERLY" | "ANNUAL"> = {
  THIRTY_DAY: "THIRTY_DAY",
  SIXTY_DAY: "SIXTY_DAY",
  NINETY_DAY: "NINETY_DAY",
  QUARTERLY: "QUARTERLY",
  YEARLY: "ANNUAL",
};

/**
 * Meeting types that count toward a milestone when the meeting was not linked
 * explicitly. New hires get an automatic QUARTERLY 1:1 at ~90 days, so it
 * satisfies the 90-day review.
 */
const COMPATIBLE_TYPES: Record<MilestoneKind, string[]> = {
  THIRTY_DAY: ["THIRTY_DAY"],
  SIXTY_DAY: ["SIXTY_DAY"],
  NINETY_DAY: ["NINETY_DAY", "QUARTERLY"],
  QUARTERLY: ["QUARTERLY"],
  YEARLY: ["ANNUAL"],
};

/** How far (in days) an unlinked meeting may sit from the due date and still count. */
const MATCH_WINDOW_DAYS: Record<MilestoneKind, number> = {
  THIRTY_DAY: 14,
  SIXTY_DAY: 14,
  NINETY_DAY: 14,
  QUARTERLY: 30,
  YEARLY: 45,
};

export type ReviewMilestone = {
  /** Stable identifier: `<employeeId>:<kind>:<YYYY-MM-DD>`. */
  key: string;
  employeeId: string;
  kind: MilestoneKind;
  label: string;
  /** Due date as a company-zone `YYYY-MM-DD` key. */
  dueKey: string;
};

export type MilestoneStatus = "due" | "overdue" | "scheduled" | "completed";

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  due: "Not scheduled",
  overdue: "Overdue, not scheduled",
  scheduled: "Scheduled",
  completed: "Completed",
};

export type ResolvedMilestone = ReviewMilestone & {
  status: MilestoneStatus;
  meetingId?: string;
  /** Day key of the linked meeting. */
  meetingKey?: string;
};

export type MilestoneMeeting = {
  id: string;
  employeeId: string;
  type: string;
  status: string; // SCHEDULED | COMPLETED | CANCELLED
  /** Company-zone day key of the meeting. */
  dayKey: string;
  milestoneKey?: string | null;
};

// ---------- date-key arithmetic (proleptic UTC grid, no zone) ----------

function toUtc(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToKey(key: string, days: number): string {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Adds calendar months, clamping to the last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonthsToKey(key: string, months: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtc(target);
}

export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Date-only columns are stored as UTC midnight; read their calendar day with UTC getters. */
export function dateOnlyKey(date: Date): string {
  return fromUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
}

export function milestoneKey(employeeId: string, kind: MilestoneKind, dueKey: string): string {
  return `${employeeId}:${kind}:${dueKey}`;
}

export function parseMilestoneKey(key: string): { employeeId: string; kind: MilestoneKind; dueKey: string } | null {
  const match = /^(.+):(THIRTY_DAY|SIXTY_DAY|NINETY_DAY|QUARTERLY|YEARLY):(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!match) return null;
  return { employeeId: match[1], kind: match[2] as MilestoneKind, dueKey: match[3] };
}

/**
 * Every milestone for one employee whose due date falls within
 * [fromKey, toKey] (inclusive):
 *  - 30, 60 and 90 days after the start date;
 *  - quarterly every 3 months after that (months 6, 9, 15, 18, …), skipping
 *    the months that are a work anniversary;
 *  - yearly on each work anniversary (12, 24, … months).
 * Quarterly and yearly reviews follow the anniversary date when one is set.
 */
export function computeEmployeeMilestones(
  employee: { id: string; startDate: Date | string; anniversaryDate?: Date | string | null },
  fromKey: string,
  toKey: string
): ReviewMilestone[] {
  const startKey = typeof employee.startDate === "string" ? employee.startDate.slice(0, 10) : dateOnlyKey(employee.startDate);
  const anniversary = employee.anniversaryDate
    ? typeof employee.anniversaryDate === "string" ? employee.anniversaryDate.slice(0, 10) : dateOnlyKey(employee.anniversaryDate)
    : null;
  const cadenceKey = anniversary || startKey;
  const results: ReviewMilestone[] = [];
  const push = (kind: MilestoneKind, dueKey: string) => {
    if (dueKey < fromKey || dueKey > toKey || dueKey <= startKey) return;
    results.push({ key: milestoneKey(employee.id, kind, dueKey), employeeId: employee.id, kind, label: MILESTONE_LABEL[kind], dueKey });
  };

  push("THIRTY_DAY", addDaysToKey(startKey, 30));
  push("SIXTY_DAY", addDaysToKey(startKey, 60));
  push("NINETY_DAY", addDaysToKey(startKey, 90));

  // Quarters 2, 3, 5, 6, 7, 9, … — quarter 1 is the 90-day review and every
  // fourth quarter is the yearly review.
  for (let quarter = 2; quarter < 400; quarter++) {
    const dueKey = addMonthsToKey(cadenceKey, quarter * 3);
    if (dueKey > toKey) break;
    push(quarter % 4 === 0 ? "YEARLY" : "QUARTERLY", dueKey);
  }
  return results.sort((a, b) => a.dueKey.localeCompare(b.dueKey));
}

/**
 * Marks each milestone scheduled/completed when a meeting is linked to it (by
 * milestoneKey) or, failing that, when an unlinked meeting of a compatible
 * type sits close enough to its due date. Each meeting satisfies at most one
 * milestone. Unsatisfied milestones are "due", or "overdue" once past today.
 */
export function resolveMilestones(
  milestones: ReviewMilestone[],
  meetings: MilestoneMeeting[],
  todayKey: string
): ResolvedMilestone[] {
  const live = meetings.filter((meeting) => meeting.status !== "CANCELLED");
  const used = new Set<string>();
  const byKey = new Map<string, MilestoneMeeting>();
  for (const meeting of live) {
    if (meeting.milestoneKey && !byKey.has(meeting.milestoneKey)) byKey.set(meeting.milestoneKey, meeting);
  }

  const resolved = new Map<string, ResolvedMilestone>();
  // Explicit links first so a heuristic match never steals a linked meeting.
  for (const milestone of milestones) {
    const linked = byKey.get(milestone.key);
    if (!linked) continue;
    used.add(linked.id);
    resolved.set(milestone.key, withMeeting(milestone, linked));
  }
  for (const milestone of milestones) {
    if (resolved.has(milestone.key)) continue;
    const window = MATCH_WINDOW_DAYS[milestone.kind];
    const candidates = live
      .filter((meeting) =>
        !used.has(meeting.id) &&
        !meeting.milestoneKey &&
        meeting.employeeId === milestone.employeeId &&
        COMPATIBLE_TYPES[milestone.kind].includes(meeting.type) &&
        Math.abs(daysBetweenKeys(milestone.dueKey, meeting.dayKey)) <= window
      )
      .sort((a, b) => Math.abs(daysBetweenKeys(milestone.dueKey, a.dayKey)) - Math.abs(daysBetweenKeys(milestone.dueKey, b.dayKey)));
    const match = candidates[0];
    if (match) {
      used.add(match.id);
      resolved.set(milestone.key, withMeeting(milestone, match));
    } else {
      resolved.set(milestone.key, { ...milestone, status: milestone.dueKey < todayKey ? "overdue" : "due" });
    }
  }
  return milestones.map((milestone) => resolved.get(milestone.key)!);
}

function withMeeting(milestone: ReviewMilestone, meeting: MilestoneMeeting): ResolvedMilestone {
  return {
    ...milestone,
    status: meeting.status === "COMPLETED" ? "completed" : "scheduled",
    meetingId: meeting.id,
    meetingKey: meeting.dayKey,
  };
}

/** Days ahead of a due date that the manager is reminded to schedule it. */
export const REMINDER_LEAD_DAYS = 7;

/**
 * Unscheduled milestones due within the next `leadDays` days (today
 * included) that have not been reminded yet. A day the job did not run is
 * caught up on the next run instead of being skipped.
 */
export function selectDueReminders(
  milestones: ResolvedMilestone[],
  todayKey: string,
  alreadySent: ReadonlySet<string>,
  leadDays = REMINDER_LEAD_DAYS
): ResolvedMilestone[] {
  const lastKey = addDaysToKey(todayKey, leadDays);
  return milestones.filter((milestone) =>
    milestone.status === "due" &&
    milestone.dueKey >= todayKey &&
    milestone.dueKey <= lastKey &&
    !alreadySent.has(milestone.key)
  );
}

export type MilestoneViewer = {
  role?: string | null;
  employeeId?: string | null;
  /** Oversight-alert recipients see milestones for their configured departments. */
  oversightDepartmentIds?: readonly string[] | "all" | null;
};

export function isAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

/** True when `managerEmployeeId` sits anywhere above `employeeId` in the reporting line. */
export function isInManagerChain(
  employeeId: string,
  managerEmployeeId: string,
  managerOf: ReadonlyMap<string, string | null | undefined>
): boolean {
  const seen = new Set<string>([employeeId]);
  let current = managerOf.get(employeeId);
  while (current && !seen.has(current)) {
    if (current === managerEmployeeId) return true;
    seen.add(current);
    current = managerOf.get(current);
  }
  return false;
}

/**
 * Review milestones are private to the employee's manager chain, admins/HR and
 * the configured oversight recipients — never to the employee or their peers.
 */
export function canSeeEmployeeMilestones(
  viewer: MilestoneViewer,
  employee: { id: string; departmentId?: string | null },
  managerOf: ReadonlyMap<string, string | null | undefined>
): boolean {
  if (isAdminRole(viewer.role)) return true;
  if (!viewer.employeeId || viewer.employeeId === employee.id) return false;
  if (isInManagerChain(employee.id, viewer.employeeId, managerOf)) return true;
  const scope = viewer.oversightDepartmentIds;
  if (scope === "all") return true;
  return !!scope && !!employee.departmentId && scope.includes(employee.departmentId);
}

/** Whether an oversight rule with these departments covers an employee in `departmentId` (empty list = everyone). */
export function oversightCoversDepartment(ruleDepartmentIds: readonly string[], departmentId?: string | null): boolean {
  if (ruleDepartmentIds.length === 0) return true;
  return !!departmentId && ruleDepartmentIds.includes(departmentId);
}

/** Only admins/HR and managers in the chain may schedule a milestone. */
export function canScheduleEmployeeMilestones(
  viewer: MilestoneViewer,
  employeeId: string,
  managerOf: ReadonlyMap<string, string | null | undefined>
): boolean {
  if (isAdminRole(viewer.role)) return true;
  if (viewer.role !== "MANAGER" || !viewer.employeeId) return false;
  return isInManagerChain(employeeId, viewer.employeeId, managerOf);
}
