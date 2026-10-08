import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { loadEmployeesLite } from "./batch-service";
import { EMPLOYEE_FK_TARGETS, type EmployeeFkTarget } from "./employee-fk-targets";
import { createOrgResolver, employeeUpdateFromRowData } from "./employee-write";
import { matchManager } from "./manager-match";
import { planMergeLogins, type GroupLogin } from "./merge-logins";
import type { RowData } from "./types";

export type MergeEmployeesArgs = {
  primaryId: string;
  duplicateIds: string[];
  /** The Result column — validated row data applied to the primary after the duplicates are gone. */
  data: RowData;
  actorUserId: string;
};

export type MergeEmployeesResult = {
  /** Rows re-pointed from a duplicate to the primary, keyed "Model.field" (only non-zero entries). */
  moved: Record<string, number>;
  /** Rows dropped because the primary already had the equivalent (unique constraint), keyed "Model.field". */
  dropped: Record<string, number>;
  /** Login email moved from a duplicate to the primary, when the primary had none. */
  relinkedUser: string | null;
  /** Login emails detached because the primary already had a login. */
  detachedUsers: string[];
  /** Duplicate employee ids that were deleted. */
  deleted: string[];
  /** Reasons a Result value was not applied to the primary. */
  notes: string[];
};

type Delegate = {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }[]>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

function delegateFor(target: EmployeeFkTarget): Delegate {
  const d = (db as unknown as Record<string, Delegate | undefined>)[target.delegate];
  if (!d) throw new Error(`No Prisma delegate "${target.delegate}" for ${target.model}`);
  return d;
}

function prismaCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
}
const isUniqueViolation = (err: unknown) => prismaCode(err) === "P2002";
const isNotFound = (err: unknown) => prismaCode(err) === "P2025";

/**
 * Point every row of one foreign key from `dupId` at `primaryId`. Tries a single `updateMany`;
 * when a unique constraint collides (the primary already has the same club membership, reaction,
 * balance, …) it goes row by row and drops the duplicate's copy where it cannot move.
 */
async function repoint(
  target: EmployeeFkTarget,
  dupId: string,
  primaryId: string,
  groupIds: string[],
): Promise<{ moved: number; dropped: number }> {
  const d = delegateFor(target);
  const where: Record<string, unknown> = { [target.field]: dupId };
  // Self-relations (manager / buddy): a duplicate pointing at a duplicate is deleted anyway, and the
  // primary must never end up as its own manager — those rows are left to onDelete: SetNull.
  if (target.model === "Employee") where.id = { notIn: groupIds };
  const data = { [target.field]: primaryId };

  try {
    const { count } = await d.updateMany({ where, data });
    return { moved: count, dropped: 0 };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  let moved = 0;
  let dropped = 0;
  for (const row of await d.findMany({ where, select: { id: true } })) {
    try {
      await d.update({ where: { id: row.id }, data });
      moved++;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      await d.delete({ where: { id: row.id } });
      dropped++;
    }
  }
  return { moved, dropped };
}

/**
 * Merge duplicate employees into one (spec §6). Steps run table by table rather than in one
 * transaction — Postgres aborts a transaction on the first unique violation and we recover from
 * those — and every step is idempotent, so re-running a partially failed merge is safe:
 *   1. re-point all 49 employee foreign keys from each duplicate to the primary;
 *   2. logins: the group login whose address is the Result email is kept (moved to the primary
 *      if needed); every other login is detached and deactivated — a detached login that could
 *      still sign in would recreate the duplicate profile on its next sign-in (see auth.ts);
 *   3. delete the duplicate employees;
 *   4. apply the Result data to the primary with the import-update rules; when a login is kept
 *      the primary's email becomes that login's address;
 *   5. one `employee.merged` audit entry.
 */
export async function mergeEmployees(args: MergeEmployeesArgs): Promise<MergeEmployeesResult> {
  const { primaryId, actorUserId, data } = args;
  const duplicateIds = Array.from(new Set(args.duplicateIds)).filter((id) => id !== primaryId);
  if (duplicateIds.length === 0) throw new Error("Nothing to merge — pick at least one duplicate");

  // findUnique is not subject to the archived-employee filter in db.ts.
  const primary = await db.employee.findUnique({
    where: { id: primaryId },
    include: { manager: { select: { firstName: true, lastName: true } } },
  });
  if (!primary) throw new Error("The primary person no longer exists");
  const duplicates = (
    await Promise.all(duplicateIds.map((id) => db.employee.findUnique({ where: { id } })))
  ).filter((e) => e !== null);
  if (duplicates.length === 0) throw new Error("The duplicates no longer exist — scan again");
  const groupIds = [primaryId, ...duplicateIds];

  const moved: Record<string, number> = {};
  const dropped: Record<string, number> = {};
  const bump = (bag: Record<string, number>, key: string, n: number) => {
    if (n > 0) bag[key] = (bag[key] ?? 0) + n;
  };

  // 1. Foreign keys. User.employeeId is unique and needs the relink/detach rule below.
  for (const dup of duplicates) {
    for (const target of EMPLOYEE_FK_TARGETS) {
      if (target.model === "User") continue;
      const key = `${target.model}.${target.field}`;
      const r = await repoint(target, dup.id, primaryId, groupIds);
      bump(moved, key, r.moved);
      bump(dropped, key, r.dropped);
    }
  }

  // 2. Logins. Detach the losers before relinking the winner: User.employeeId is unique.
  const logins: GroupLogin[] = (
    await db.user.findMany({ where: { employeeId: { in: groupIds } }, select: { id: true, employeeId: true, email: true } })
  ).flatMap((u) => (u.employeeId ? [{ userId: u.id, employeeId: u.employeeId, email: u.email }] : []));
  const loginPlan = planMergeLogins({ primaryId, duplicateIds: duplicates.map((d) => d.id), logins, resultEmail: data.email });
  const detachedUsers: string[] = [];
  for (const loser of loginPlan.detached) {
    await db.user.update({ where: { id: loser.userId }, data: { employeeId: null, deactivatedAt: new Date() } });
    detachedUsers.push(loser.email);
  }
  let relinkedUser: string | null = null;
  if (loginPlan.kept && loginPlan.kept.employeeId !== primaryId) {
    await db.user.update({ where: { id: loginPlan.kept.userId }, data: { employeeId: primaryId } });
    relinkedUser = loginPlan.kept.email;
  }

  // 3. Delete the duplicates (anything still attached cascades or nulls per the schema).
  const deleted: string[] = [];
  for (const dup of duplicates) {
    try {
      await db.employee.delete({ where: { id: dup.id } });
      deleted.push(dup.id);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  // 4. Apply the Result column to the primary. Runs after the deletes so the primary can take a
  //    duplicate's (unique) email. With a login kept, the email is settled here — it follows the
  //    login — rather than by the import-update rules, which would refuse to move off a login.
  const org = await createOrgResolver();
  const isEmailTaken = async (email: string) => !!(await db.employee.findUnique({ where: { email }, select: { id: true } }));
  const dataWithoutEmail: RowData = { ...data };
  delete dataWithoutEmail.email;
  const { patch, notes } = await employeeUpdateFromRowData(primary, loginPlan.kept ? dataWithoutEmail : data, { org, isEmailTaken });
  notes.push(...loginPlan.notes);
  if (loginPlan.kept) {
    const next = loginPlan.kept.email.toLowerCase();
    if (next !== primary.email.toLowerCase()) {
      if (await isEmailTaken(next)) notes.push(`Email kept — ${loginPlan.kept.email} is already used by someone else`);
      else patch.email = next;
    }
  }
  // The Result column shows managers by name; only resolve it when it differs from the primary's
  // current manager (whose name may be ambiguous — or a duplicate that was just deleted).
  const currentManager = primary.manager ? `${primary.manager.firstName} ${primary.manager.lastName}`.trim() : null;
  if (data.manager && data.manager.trim().toLowerCase() !== currentManager?.toLowerCase()) {
    const people = (await loadEmployeesLite()).filter((p) => p.id !== primaryId);
    const match = matchManager(data.manager, people);
    if ("id" in match) patch.managerId = match.id;
    else if (match.error === "none") notes.push(`Manager "${data.manager}" not found`);
    else notes.push(`Manager "${data.manager}" matches more than one person`);
  }
  await db.employee.update({ where: { id: primaryId }, data: patch });

  // 5. Audit.
  const name = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();
  await audit({
    action: "employee.merged",
    entityType: "employee",
    entityId: primaryId,
    details: {
      actorUserId,
      primary: { id: primaryId, name: name(primary), email: primary.email },
      merged: duplicates.map((d) => ({ id: d.id, name: name(d), email: d.email })),
      moved,
      dropped,
      relinkedUser,
      detachedUsers,
      fields: Object.keys(patch),
      notes,
    },
  });

  return { moved, dropped, relinkedUser, detachedUsers, deleted, notes };
}
