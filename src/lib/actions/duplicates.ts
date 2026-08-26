"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { detectDuplicates, isStrongGroup, pairKey } from "@/lib/import-export/duplicates";
import { mergeEmployeeData } from "@/lib/import-export/merge";
import { validateRow } from "@/lib/import-export/normalize";
import { loadEmployeeSnapshots } from "@/lib/import-export/batch-service";
import { mergeEmployees, type MergeEmployeesResult } from "@/lib/import-export/employee-merge-service";
import type { EmployeeSnapshot, FieldKey, GroupReason, MemberRef, MergeMember } from "@/lib/import-export/types";

export type SystemGroup = { id: string; reasons: GroupReason[]; members: MemberRef[] };

export type SystemScan = {
  groups: SystemGroup[];
  employees: Record<string, EmployeeSnapshot>;
  /** Login email bound to each employee that appears in a group, when there is one. */
  logins: Record<string, string>;
  /** How many (non-archived) people were scanned. */
  scanned: number;
  scannedAt: string;
};

export type SystemMergeResult = MergeEmployeesResult & { primaryName: string; mergedNames: string[] };

async function requireDuplicateAccess() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") throw new Error("Forbidden");
  return session;
}

/**
 * Run duplicate detection over every non-archived person with employee↔employee pairing on
 * (spec §6). Nothing is persisted; dismissed pairs never link.
 */
export async function scanSystemDuplicates(): Promise<SystemScan> {
  await requireDuplicateAccess();
  const [people, dismissals] = await Promise.all([
    // db.ts hides archived people from findMany by default — exactly the set we want.
    db.employee.findMany({
      select: { id: true, firstName: true, lastName: true, preferredName: true, email: true, phone: true, createdAt: true },
    }),
    db.duplicateDismissal.findMany({ select: { employeeAId: true, employeeBId: true } }),
  ]);
  const dismissedPairs = new Set(dismissals.map((d) => pairKey(d.employeeAId, d.employeeBId)));
  const detected = detectDuplicates([], people, { pairEmployees: true, dismissedPairs });

  const ids = Array.from(new Set(detected.flatMap((g) => g.members.map((m) => m.id))));
  const [employees, users] = await Promise.all([
    loadEmployeeSnapshots(ids),
    ids.length > 0
      ? db.user.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true, email: true } })
      : Promise.resolve([]),
  ]);
  const logins: Record<string, string> = {};
  for (const u of users) if (u.employeeId) logins[u.employeeId] = u.email;

  // Within a group: people with a login first, then the oldest record — a sensible default primary.
  const createdAt = new Map(people.map((p) => [p.id, p.createdAt.getTime()]));
  const memberOrder = (a: MemberRef, b: MemberRef) => {
    const la = logins[a.id] ? 0 : 1;
    const lb = logins[b.id] ? 0 : 1;
    if (la !== lb) return la - lb;
    const ca = createdAt.get(a.id) ?? 0;
    const cb = createdAt.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  };
  const groups: SystemGroup[] = detected.map((g) => ({ id: g.key, reasons: g.reasons, members: [...g.members].sort(memberOrder) }));
  // Strong signals first, then alphabetically by the first person's name.
  const nameOf = (g: SystemGroup) => employees[g.members[0].id]?.name ?? "";
  groups.sort((a, b) => {
    const sa = isStrongGroup(a.reasons) ? 0 : 1;
    const sb = isStrongGroup(b.reasons) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id);
  });

  return { groups, employees, logins, scanned: people.length, scannedAt: new Date().toISOString() };
}

/**
 * Merge a scanned group into `primaryId`: the Result column (choices + typed-over values) is
 * validated like import data, then `mergeEmployees` re-points every relation, sorts out logins,
 * deletes the duplicates and updates the primary.
 */
export async function mergeSystemGroup(
  primaryId: string,
  duplicateIds: string[],
  choices: Partial<Record<FieldKey, MemberRef>>,
  overrides: Partial<Record<FieldKey, string>> = {},
): Promise<SystemMergeResult> {
  const session = await requireDuplicateAccess();
  const dups = Array.from(new Set(duplicateIds)).filter((id) => id !== primaryId);
  if (dups.length === 0) throw new Error("Pick at least one duplicate to merge into the primary");

  const ids = [primaryId, ...dups];
  const snapshots = await loadEmployeeSnapshots(ids);
  if (ids.some((id) => !snapshots[id])) throw new Error("One of these people no longer exists — scan again");

  const members: MergeMember[] = ids.map((id) => ({ ref: { kind: "employee" as const, id }, data: snapshots[id].data }));
  const primary: MemberRef = { kind: "employee", id: primaryId };
  for (const ref of Object.values(choices)) {
    if (ref && !ids.includes(ref.id)) throw new Error("A field choice points outside this group");
  }
  const { data, errors } = validateRow(mergeEmployeeData(members, primary, choices, overrides));
  if (errors.length > 0) throw new Error(`Fix these before merging: ${errors.map((e) => e.message).join("; ")}`);

  const result = await mergeEmployees({ primaryId, duplicateIds: dups, data, actorUserId: session.user.id });
  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/data");
  return { ...result, primaryName: snapshots[primaryId].name, mergedNames: dups.map((id) => snapshots[id].name) };
}

/** Record every pair in the group as "not duplicates" so the scan never links them again. */
export async function dismissSystemGroup(memberIds: string[]): Promise<void> {
  const session = await requireDuplicateAccess();
  const ids = Array.from(new Set(memberIds));
  if (ids.length < 2) throw new Error("A group needs at least two people");
  const rows: { employeeAId: string; employeeBId: string; dismissedById: string }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      rows.push({ employeeAId: a, employeeBId: b, dismissedById: session.user.id });
    }
  }
  await db.duplicateDismissal.createMany({ data: rows, skipDuplicates: true });
  await audit({ action: "duplicates.dismissed", entityType: "employee", details: { employeeIds: ids, pairs: rows.length } });
  revalidatePath("/data");
}
