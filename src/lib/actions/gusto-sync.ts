"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isGustoConnected } from "@/lib/actions/gusto";
import { loadEmployeesLite } from "@/lib/import-export/batch-service";
import { employeeToRowData } from "@/lib/import-export/employee-row";
import { createOrgResolver, employeeUpdateFromRowData, type OrgResolver } from "@/lib/import-export/employee-write";
import { matchManager, type ManagerCandidate } from "@/lib/import-export/manager-match";
import {
  buildGustoIndex,
  diffGustoData,
  gustoDisplayName,
  matchGustoPerson,
  selectGustoChanges,
  type GustoIndex,
} from "@/lib/gusto-sync/match";
import { loadGustoPeople } from "@/lib/gusto-sync/source";
import type {
  GustoApplyOutcome,
  GustoApplyResult,
  GustoMatch,
  GustoMatchesResult,
  GustoSyncStrategy,
} from "@/lib/gusto-sync/types";

// ── Shared ──────────────────────────────────────────────────

async function requireSyncRole() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }
  return session;
}

function assertStrategy(strategy: GustoSyncStrategy): void {
  if (strategy !== "fill" && strategy !== "overwrite") throw new Error("Unknown strategy");
}

/** Department/team/manager names come along so employeeToRowData compares the same way an import does. */
const SYNC_INCLUDE = {
  department: { select: { name: true } },
  team: { select: { name: true } },
  manager: { select: { firstName: true, lastName: true, preferredName: true } },
} as const;

/** Every Gusto id already linked to a person, archived people included (the column is unique). */
async function claimedGustoIds(): Promise<string[]> {
  const select = { gustoEmployeeId: true } as const;
  const [active, archived] = await Promise.all([
    db.employee.findMany({ where: { gustoEmployeeId: { not: null } }, select }),
    db.employee.findMany({ where: { gustoEmployeeId: { not: null }, archivedAt: { not: null } }, select }),
  ]);
  return [...active, ...archived].flatMap((e) => (e.gustoEmployeeId ? [e.gustoEmployeeId] : []));
}

async function loadIndex(): Promise<{ index: GustoIndex; fetchedAt: string }> {
  const [{ people, fetchedAt }, claimed] = await Promise.all([loadGustoPeople(), claimedGustoIds()]);
  return { index: buildGustoIndex(people, claimed), fetchedAt };
}

type SyncEmployee = Parameters<typeof employeeToRowData>[0] & { id: string; gustoEmployeeId: string | null };

function matchEmployee(employee: SyncEmployee, index: GustoIndex): GustoMatch | null {
  const current = employeeToRowData(employee);
  const hit = matchGustoPerson({ id: employee.id, gustoEmployeeId: employee.gustoEmployeeId, data: current }, index);
  if (!hit) return null;
  return {
    gustoId: hit.person.gustoId,
    gustoName: gustoDisplayName(hit.person.data),
    matchedBy: hit.matchedBy,
    data: hit.person.data,
    changes: diffGustoData(current, hit.person.data),
  };
}

// ── Compare ─────────────────────────────────────────────────

/**
 * What Gusto has for each person compared with the system. Never throws for a disconnected
 * Gusto (`connected: false`, every match null); a Gusto API failure does propagate.
 */
export async function getGustoMatches(employeeIds: string[]): Promise<GustoMatchesResult> {
  await requireSyncRole();
  const ids = Array.from(new Set(employeeIds.filter(Boolean)));
  const matches: Record<string, GustoMatch | null> = Object.fromEntries(ids.map((id) => [id, null]));

  const connected = await isGustoConnected();
  if (!connected || ids.length === 0) return { connected, fetchedAt: new Date().toISOString(), matches };

  const [{ index, fetchedAt }, employees] = await Promise.all([
    loadIndex(),
    db.employee.findMany({ where: { id: { in: ids } }, include: SYNC_INCLUDE }),
  ]);
  for (const employee of employees) matches[employee.id] = matchEmployee(employee, index);
  return { connected: true, fetchedAt, matches };
}

// ── Apply ───────────────────────────────────────────────────

type ApplyContext = {
  index: GustoIndex;
  org: OrgResolver;
  /** Everyone who can be a manager, loaded once per call and only when a manager needs resolving. */
  people: () => Promise<ManagerCandidate[]>;
};

async function createApplyContext(): Promise<ApplyContext> {
  if (!(await isGustoConnected())) throw new Error("Gusto is not connected");
  const [{ index }, org] = await Promise.all([loadIndex(), createOrgResolver()]);
  let people: Promise<ManagerCandidate[]> | null = null;
  return { index, org, people: () => (people ??= loadEmployeesLite()) };
}

const isEmailTaken = async (email: string) =>
  !!(await db.employee.findUnique({ where: { email }, select: { id: true } }));

/**
 * Write the matched Gusto record onto one person with the import-update rules (blanks never
 * clear, status never changes, a login email is kept). Returns null when nobody in Gusto matches.
 */
async function applyOne(employeeId: string, strategy: GustoSyncStrategy, ctx: ApplyContext): Promise<GustoApplyOutcome | null> {
  const employee = await db.employee.findFirst({ where: { id: employeeId }, include: SYNC_INCLUDE });
  if (!employee) throw new Error("This person no longer exists");

  const match = matchEmployee(employee, ctx.index);
  if (!match) return null;

  const data = selectGustoChanges(match.changes, strategy);
  const { patch, notes } = await employeeUpdateFromRowData(employee, data, { org: ctx.org, isEmailTaken });

  if (data.manager) {
    const people = (await ctx.people()).filter((p) => p.id !== employee.id);
    const manager = matchManager(data.manager, people);
    if ("id" in manager) patch.managerId = manager.id;
    else if (manager.error === "none") notes.push(`Manager "${data.manager}" not found`);
    else notes.push(`Manager "${data.manager}" matches more than one person`);
  }
  if (!employee.gustoEmployeeId) patch.gustoEmployeeId = match.gustoId;

  const fields = Object.keys(patch);
  if (fields.length === 0) return { fields, notes };

  try {
    await db.employee.update({ where: { id: employee.id }, data: patch });
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "P2002") {
      throw new Error("This Gusto record is already linked to someone else");
    }
    throw err;
  }
  ctx.index.claimed.add(match.gustoId);

  await audit({
    action: "employee.updated",
    entityType: "employee",
    entityId: employee.id,
    details: { via: "gusto", strategy, gustoId: match.gustoId, matchedBy: match.matchedBy, fields, notes },
  });
  revalidatePath(`/people/${employee.id}`);
  return { fields, notes };
}

export async function applyGustoToEmployee(employeeId: string, strategy: GustoSyncStrategy): Promise<GustoApplyOutcome> {
  await requireSyncRole();
  assertStrategy(strategy);
  const ctx = await createApplyContext();
  const outcome = await applyOne(employeeId, strategy, ctx);
  if (!outcome) throw new Error("No match in Gusto for this person");
  revalidatePath("/people");
  return outcome;
}

export async function applyGustoToEmployees(employeeIds: string[], strategy: GustoSyncStrategy): Promise<GustoApplyResult> {
  await requireSyncRole();
  assertStrategy(strategy);
  const ctx = await createApplyContext();
  const result: GustoApplyResult = { applied: [], unmatched: [], failed: [] };
  for (const id of Array.from(new Set(employeeIds.filter(Boolean)))) {
    try {
      const outcome = await applyOne(id, strategy, ctx);
      (outcome ? result.applied : result.unmatched).push(id);
    } catch (err) {
      result.failed.push({ id, error: err instanceof Error ? err.message : "Something went wrong" });
    }
  }
  revalidatePath("/people");
  return result;
}
