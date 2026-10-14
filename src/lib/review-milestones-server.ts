import { db } from "@/lib/db";
import { dateKey, zonedDateFromInput } from "@/lib/time-zone";
import {
  addDaysToKey,
  computeEmployeeMilestones,
  resolveMilestones,
  type ResolvedMilestone,
} from "@/lib/review-milestones";

export type MilestoneEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  startDate: Date;
  anniversaryDate: Date | null;
  managerId: string | null;
  departmentId: string | null;
};

/**
 * Active employees' review milestones due within [fromKey, toKey], resolved
 * against their 1:1 meetings, plus the reporting lines used for access checks.
 * Callers filter by viewer before showing or sending anything.
 */
export async function loadReviewMilestones(range: { fromKey: string; toKey: string; todayKey: string }) {
  const employees: MilestoneEmployee[] = await db.employee.findMany({
    where: { status: "ACTIVE", archivedAt: null },
    select: {
      id: true, firstName: true, lastName: true, preferredName: true, email: true,
      startDate: true, anniversaryDate: true, managerId: true, departmentId: true,
    },
  });
  const managerOf = new Map(employees.map((employee) => [employee.id, employee.managerId]));
  // Managers who are not ACTIVE (e.g. onboarding) still count in the chain.
  const missing = [...new Set(employees.flatMap((employee) => employee.managerId && !managerOf.has(employee.managerId) ? [employee.managerId] : []))];
  if (missing.length) {
    const extra = await db.employee.findMany({ where: { id: { in: missing } }, select: { id: true, managerId: true } });
    for (const row of extra) managerOf.set(row.id, row.managerId);
  }

  const milestones = employees.flatMap((employee) => computeEmployeeMilestones(employee, range.fromKey, range.toKey));
  if (milestones.length === 0) return { employees, managerOf, milestones: [] as ResolvedMilestone[] };

  // Unlinked meetings may sit up to 45 days from a due date and still count.
  const meetingFrom = zonedDateFromInput(addDaysToKey(range.fromKey, -60)) ?? new Date(0);
  const meetingTo = zonedDateFromInput(addDaysToKey(range.toKey, 61)) ?? new Date(8.64e15);
  const meetings = await db.oneOnOne.findMany({
    where: {
      employeeId: { in: [...new Set(milestones.map((milestone) => milestone.employeeId))] },
      OR: [
        { scheduledAt: { gte: meetingFrom, lt: meetingTo } },
        { milestoneKey: { in: milestones.map((milestone) => milestone.key) } },
      ],
    },
    select: { id: true, employeeId: true, type: true, status: true, scheduledAt: true, milestoneKey: true },
  });
  const resolved = resolveMilestones(
    milestones,
    meetings.map((meeting) => ({ ...meeting, dayKey: dateKey(meeting.scheduledAt) })),
    range.todayKey
  );
  return { employees, managerOf, milestones: resolved };
}
