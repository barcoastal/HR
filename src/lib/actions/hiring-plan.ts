"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = "singleton";

export type HiringSlot = {
  id: string;
  label: string;
  employeeId?: string | null;
};

export type HiringBox = {
  id: string;
  title: string;
  color: string; // tailwind color name we map to a palette in the UI
  slots: HiringSlot[];
};

export type HiringPlanData = {
  boxes: HiringBox[];
};

const DEFAULT_PLAN: HiringPlanData = { boxes: [] };

async function gate() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getHiringPlan(): Promise<HiringPlanData> {
  await gate();
  const row = await db.hiringPlan.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return DEFAULT_PLAN;
  try {
    return row.data as unknown as HiringPlanData;
  } catch {
    return DEFAULT_PLAN;
  }
}

export async function saveHiringPlan(data: HiringPlanData) {
  await gate();
  await db.hiringPlan.upsert({
    where: { id: SINGLETON_ID },
    update: { data: data as unknown as object },
    create: { id: SINGLETON_ID, data: data as unknown as object },
  });
  revalidatePath("/hiring-plan");
  return { success: true };
}

/**
 * Build a fresh plan snapshot from the current org:
 *  - One box per active Team, containing that team's active employees.
 *  - Plus one box per Department for any employees that aren't on a Team.
 *  - Each OPEN Position in a department becomes a TBH slot under one of
 *    that department's boxes (the team with fewest members, or the
 *    "Unassigned" box if no teams exist for that dept).
 * Used by the "Snapshot current org" button on the hiring plan page.
 */
export async function snapshotCurrentOrg(): Promise<HiringPlanData> {
  await gate();

  const [teams, employees, openPositions] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true, departmentId: true } }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        teamId: true,
        departmentId: true,
        jobTitle: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.position.findMany({
      where: { status: "OPEN" },
      select: { id: true, title: true, departmentId: true },
    }),
  ]);

  const colorAtIdx = (i: number) => ["green", "blue", "amber", "purple", "rose", "slate", "cyan"][i % 7];
  let boxIdCounter = 0;
  const nextBoxId = () => `box-snap-${boxIdCounter++}`;
  const nextSlotId = () => `slot-snap-${Math.random().toString(36).slice(2, 10)}`;

  const boxes: HiringBox[] = [];
  const teamBoxIndex = new Map<string, number>(); // teamId → boxes[] index

  for (const team of teams) {
    const teamEmployees = employees.filter((e) => e.teamId === team.id);
    boxes.push({
      id: nextBoxId(),
      title: team.name,
      color: colorAtIdx(boxes.length),
      slots: teamEmployees.map((e) => ({
        id: nextSlotId(),
        label: `${e.firstName} ${e.lastName}`,
        employeeId: e.id,
      })),
    });
    teamBoxIndex.set(team.id, boxes.length - 1);
  }

  // Employees with no team — group them by department under an "Unassigned"
  // box per dept so they still appear on the plan.
  const teamlessByDept = new Map<string, typeof employees>();
  for (const e of employees) {
    if (e.teamId) continue;
    const key = e.departmentId ?? "__no_dept__";
    const list = teamlessByDept.get(key) ?? [];
    list.push(e);
    teamlessByDept.set(key, list);
  }
  const deptNames = await db.department.findMany({
    where: { id: { in: Array.from(teamlessByDept.keys()).filter((k) => k !== "__no_dept__") } },
    select: { id: true, name: true },
  });
  const deptNameById = new Map(deptNames.map((d) => [d.id, d.name]));
  for (const [deptKey, list] of teamlessByDept) {
    const deptName = deptKey === "__no_dept__" ? "No department" : (deptNameById.get(deptKey) || "Unassigned");
    boxes.push({
      id: nextBoxId(),
      title: `${deptName} (unassigned)`,
      color: colorAtIdx(boxes.length),
      slots: list.map((e) => ({
        id: nextSlotId(),
        label: `${e.firstName} ${e.lastName}`,
        employeeId: e.id,
      })),
    });
  }

  // Add a TBH slot per OPEN position to the box for its department (best
  // matching team box, or a fallback dept-level box if needed).
  const boxByDept = new Map<string, number>();
  for (const team of teams) {
    if (team.departmentId && !boxByDept.has(team.departmentId)) {
      boxByDept.set(team.departmentId, teamBoxIndex.get(team.id)!);
    }
  }
  for (const pos of openPositions) {
    let boxIdx: number | undefined;
    if (pos.departmentId) boxIdx = boxByDept.get(pos.departmentId);
    if (boxIdx == null) {
      // Stand up a fallback "Open roles" box.
      boxes.push({
        id: nextBoxId(),
        title: "Open roles",
        color: colorAtIdx(boxes.length),
        slots: [],
      });
      boxIdx = boxes.length - 1;
    }
    boxes[boxIdx].slots.push({
      id: nextSlotId(),
      label: `TBH — ${pos.title}`,
      employeeId: null,
    });
  }

  return { boxes };
}
