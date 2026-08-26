"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateRow } from "@/lib/import-export/normalize";
import { buildMergePlan } from "@/lib/import-export/merge";
import { loadEmployeeSnapshots, rebuildBatchRows, runBatchDetection } from "@/lib/import-export/batch-service";
import { commitImportBatch, type CommitResult, type CommitSummary } from "@/lib/import-export/commit-service";
import {
  refKey, sameRef,
  type ColumnMapping, type EmployeeSnapshot, type FieldKey, type GroupReason, type MemberRef, type MergeMember, type RowAction, type RowData, type RowError,
} from "@/lib/import-export/types";

export type ImportBatchStatusValue = "REVIEWING" | "IMPORTED" | "DISCARDED";
export type { CommitResult, CommitSummary };

export type ImportBatchSummary = {
  id: string;
  fileName: string;
  status: ImportBatchStatusValue;
  rowCount: number;
  createdAt: string;
  importedAt: string | null;
  uploadedBy: string;
  counts: { create: number; update: number; mergedAway: number; skipped: number; invalid: number };
};

export type ImportRowView = {
  id: string;
  rowNumber: number;
  raw: string[];
  data: RowData;
  errors: RowError[];
  action: RowAction;
  targetEmployeeId: string | null;
  mergedIntoRowId: string | null;
  skipReason: string | null;
  /** Set once the batch has been imported. */
  result: CommitResult | null;
  resultEmployeeId: string | null;
  resultNotes: string[];
};

export type ImportGroupView = {
  id: string;
  status: "PENDING" | "MERGED" | "SEPARATE";
  reasons: GroupReason[];
  members: MemberRef[];
  primary: MemberRef | null;
};

export type ImportBatchDetail = {
  batch: {
    id: string;
    fileName: string;
    fileType: string;
    headers: string[];
    mapping: ColumnMapping | null;
    status: ImportBatchStatusValue;
    rowCount: number;
    createdAt: string;
    importedAt: string | null;
    uploadedBy: string;
    summary: CommitSummary | null;
  };
  rows: ImportRowView[];
  groups: ImportGroupView[];
  employees: Record<string, EmployeeSnapshot>;
  stats: { needsDecision: number; newPeople: number; updates: number; mergedAway: number; skipped: number; needsAttention: number };
};

async function requireImportAccess() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") throw new Error("Forbidden");
  return session;
}

async function requireEditableBatch(batchId: string) {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import not found");
  if (batch.status !== "REVIEWING") throw new Error("This import is no longer editable");
  return batch;
}

function revalidate(batchId: string) {
  revalidatePath("/data");
  revalidatePath(`/data/imports/${batchId}`);
}

type UploaderLite = { email: string; employee: { firstName: string; lastName: string; preferredName: string | null } | null };
const UPLOADER_SELECT = { email: true, employee: { select: { firstName: true, lastName: true, preferredName: true } } } as const;

function uploaderName(u: UploaderLite) {
  return u.employee ? `${u.employee.preferredName || u.employee.firstName} ${u.employee.lastName}` : u.email;
}

const EMPTY_COUNTS = { create: 0, update: 0, mergedAway: 0, skipped: 0, invalid: 0 };

export async function listImportBatches(): Promise<ImportBatchSummary[]> {
  await requireImportAccess();
  const [batches, counts] = await Promise.all([
    db.importBatch.findMany({ orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: UPLOADER_SELECT } } }),
    db.importRow.groupBy({ by: ["batchId", "action", "skipReason"], _count: { _all: true } }),
  ]);
  const byBatch = new Map<string, ImportBatchSummary["counts"]>();
  for (const c of counts) {
    const cur = byBatch.get(c.batchId) ?? { ...EMPTY_COUNTS };
    const n = c._count._all;
    if (c.action === "CREATE") cur.create += n;
    else if (c.action === "UPDATE") cur.update += n;
    else if (c.action === "MERGED_AWAY") cur.mergedAway += n;
    else if (c.skipReason === "invalid") cur.invalid += n;
    else cur.skipped += n;
    byBatch.set(c.batchId, cur);
  }
  return batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    status: b.status,
    rowCount: b.rowCount,
    createdAt: b.createdAt.toISOString(),
    importedAt: b.importedAt?.toISOString() ?? null,
    uploadedBy: uploaderName(b.uploadedBy),
    counts: byBatch.get(b.id) ?? { ...EMPTY_COUNTS },
  }));
}

export async function getImportBatch(id: string): Promise<ImportBatchDetail | null> {
  await requireImportAccess();
  const batch = await db.importBatch.findUnique({
    where: { id },
    include: {
      rows: { orderBy: { rowNumber: "asc" } },
      groups: { orderBy: { createdAt: "asc" } },
      uploadedBy: { select: UPLOADER_SELECT },
    },
  });
  if (!batch) return null;

  const rows: ImportRowView[] = batch.rows.map((r) => ({
    id: r.id,
    rowNumber: r.rowNumber,
    raw: r.raw as string[],
    data: r.data as RowData,
    errors: r.errors as RowError[],
    action: r.action as RowAction,
    targetEmployeeId: r.targetEmployeeId,
    mergedIntoRowId: r.mergedIntoRowId,
    skipReason: r.skipReason,
    result: (r.result as CommitResult | null) ?? null,
    resultEmployeeId: r.resultEmployeeId,
    resultNotes: (r.resultNotes as string[] | null) ?? [],
  }));
  const groups: ImportGroupView[] = batch.groups.map((g) => ({
    id: g.id,
    status: g.status,
    reasons: g.reasons as GroupReason[],
    members: g.members as MemberRef[],
    primary: (g.primary as MemberRef | null) ?? null,
  }));

  const employeeIds = new Set<string>();
  for (const g of groups) for (const m of g.members) if (m.kind === "employee") employeeIds.add(m.id);
  for (const r of rows) if (r.targetEmployeeId) employeeIds.add(r.targetEmployeeId);
  const employees = await loadEmployeeSnapshots(Array.from(employeeIds));

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const isLive = (m: MemberRef) =>
    m.kind === "employee" ? !!employees[m.id] : ["CREATE", "UPDATE"].includes(rowById.get(m.id)?.action ?? "");
  const needsDecision = groups.filter((g) => g.status === "PENDING" && g.members.filter(isLive).length >= 2).length;

  return {
    batch: {
      id: batch.id,
      fileName: batch.fileName,
      fileType: batch.fileType,
      headers: batch.headers as string[],
      mapping: (batch.mapping as ColumnMapping | null) ?? null,
      status: batch.status,
      rowCount: batch.rowCount,
      createdAt: batch.createdAt.toISOString(),
      importedAt: batch.importedAt?.toISOString() ?? null,
      uploadedBy: uploaderName(batch.uploadedBy),
      summary: (batch.summary as CommitSummary | null) ?? null,
    },
    rows,
    groups,
    employees,
    stats: {
      needsDecision,
      newPeople: rows.filter((r) => r.action === "CREATE").length,
      updates: rows.filter((r) => r.action === "UPDATE").length,
      mergedAway: rows.filter((r) => r.action === "MERGED_AWAY").length,
      skipped: rows.filter((r) => r.action === "SKIP" && r.skipReason === "user").length,
      needsAttention: rows.filter((r) => r.action === "SKIP" && r.skipReason === "invalid").length,
    },
  };
}

export async function saveImportMapping(batchId: string, mapping: ColumnMapping): Promise<void> {
  await requireImportAccess();
  const batch = await requireEditableBatch(batchId);
  const headers = batch.headers as string[];
  if (mapping.length !== headers.length) throw new Error("Mapping does not match the file columns");
  if (!mapping.includes("firstName") || !mapping.includes("lastName")) throw new Error("Map both First name and Last name");
  await db.importBatch.update({ where: { id: batchId }, data: { mapping: mapping as Prisma.InputJsonValue } });
  await rebuildBatchRows(batchId);
  revalidate(batchId);
}

async function assertNotInMergedGroup(batchId: string, rowId: string) {
  const groups = await db.importDuplicateGroup.findMany({ where: { batchId, status: "MERGED" } });
  const key = refKey({ kind: "row", id: rowId });
  if (groups.some((g) => (g.members as MemberRef[]).some((m) => refKey(m) === key))) {
    throw new Error("Undo the merge for this row first");
  }
}

export async function updateImportRow(batchId: string, rowId: string, input: RowData): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await assertNotInMergedGroup(batchId, rowId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  const { data, errors } = validateRow(input);
  const wasInvalid = row.action === "SKIP" && row.skipReason === "invalid";
  const nextAction: RowAction = errors.length > 0 ? "SKIP" : wasInvalid ? "CREATE" : (row.action as RowAction);
  await db.importRow.update({
    where: { id: rowId },
    data: {
      data: data as Prisma.InputJsonValue,
      errors: errors as Prisma.InputJsonValue,
      action: nextAction,
      skipReason: errors.length > 0 ? "invalid" : nextAction === "SKIP" ? row.skipReason : null,
    },
  });
  await runBatchDetection(batchId, { keepMerged: true });
  revalidate(batchId);
}

export async function skipImportRow(batchId: string, rowId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await assertNotInMergedGroup(batchId, rowId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  if (row.action !== "CREATE" && row.action !== "UPDATE") throw new Error("Only new or update rows can be skipped");
  await db.importRow.update({ where: { id: rowId }, data: { action: "SKIP", skipReason: "user", targetEmployeeId: null } });
  revalidate(batchId);
}

export async function unskipImportRow(batchId: string, rowId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  if (row.action !== "SKIP" || row.skipReason !== "user") throw new Error("Row is not skipped");
  const { errors } = validateRow(row.data as RowData);
  await db.importRow.update({
    where: { id: rowId },
    data: errors.length > 0
      ? { skipReason: "invalid", errors: errors as Prisma.InputJsonValue }
      : { action: "CREATE", skipReason: null },
  });
  await runBatchDetection(batchId, { keepMerged: true });
  revalidate(batchId);
}

async function loadGroupMembers(batchId: string, groupId: string) {
  const group = await db.importDuplicateGroup.findFirst({ where: { id: groupId, batchId } });
  if (!group) throw new Error("Group not found");
  const members = group.members as MemberRef[];
  const rowIds = members.filter((m) => m.kind === "row").map((m) => m.id);
  const employeeIds = members.filter((m) => m.kind === "employee").map((m) => m.id);
  const [rows, employees] = await Promise.all([
    db.importRow.findMany({ where: { id: { in: rowIds }, batchId } }),
    loadEmployeeSnapshots(employeeIds),
  ]);
  const liveRows = rows.filter((r) => r.action === "CREATE" || r.action === "UPDATE");
  const mergeMembers: MergeMember[] = [
    ...liveRows.map((r) => ({ ref: { kind: "row" as const, id: r.id }, rowNumber: r.rowNumber, data: r.data as RowData })),
    ...employeeIds.filter((id) => employees[id]).map((id) => ({ ref: { kind: "employee" as const, id }, data: employees[id].data })),
  ];
  return { group, rows, liveRows, employees, mergeMembers };
}

export async function resolveGroupMerge(
  batchId: string,
  groupId: string,
  primary: MemberRef,
  choices: Partial<Record<FieldKey, MemberRef>>,
  overrides: Partial<Record<FieldKey, string>> = {},
): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const { group, liveRows, mergeMembers } = await loadGroupMembers(batchId, groupId);
  if (group.status !== "PENDING") throw new Error("This group already has a decision");
  if (!mergeMembers.some((m) => sameRef(m.ref, primary))) throw new Error("Primary must be a member of the group");
  const plan = buildMergePlan(mergeMembers, primary, choices);

  // Hand-edited values in the Result column win over the picked column values.
  const merged: RowData = { ...plan.data };
  for (const [key, raw] of Object.entries(overrides) as [FieldKey, string | undefined][]) {
    const value = (raw ?? "").trim();
    if (value) merged[key] = value;
    else delete merged[key];
  }
  const { data: cleaned, errors } = validateRow(merged);
  if (errors.length > 0) {
    throw new Error(`Fix these before merging: ${errors.map((e) => e.message).join("; ")}`);
  }
  plan.data = cleaned;

  const snapshot = liveRows.map((r) => ({
    id: r.id, data: r.data, action: r.action, targetEmployeeId: r.targetEmployeeId, mergedIntoRowId: r.mergedIntoRowId, skipReason: r.skipReason,
  }));

  await db.$transaction(async (tx) => {
    await tx.importRow.update({
      where: { id: plan.carrierRowId },
      data: {
        data: plan.data as Prisma.InputJsonValue,
        action: plan.action,
        targetEmployeeId: plan.targetEmployeeId,
        mergedIntoRowId: null,
        skipReason: null,
        errors: [] as Prisma.InputJsonValue,
      },
    });
    if (plan.mergedAwayRowIds.length > 0) {
      await tx.importRow.updateMany({
        where: { id: { in: plan.mergedAwayRowIds } },
        data: { action: "MERGED_AWAY", mergedIntoRowId: plan.carrierRowId, targetEmployeeId: null, skipReason: null },
      });
    }
    await tx.importDuplicateGroup.update({
      where: { id: groupId },
      data: {
        status: "MERGED",
        primary: primary as unknown as Prisma.InputJsonValue,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  });
  revalidate(batchId);
}

export async function resolveGroupSeparate(batchId: string, groupId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const { group, mergeMembers } = await loadGroupMembers(batchId, groupId);
  if (group.status !== "PENDING") throw new Error("This group already has a decision");
  const emails = mergeMembers.map((m) => (m.data.email ?? "").toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) {
    throw new Error("Two of these records share the exact same email, so they cannot both be imported. Fix the email or merge them.");
  }
  await db.importDuplicateGroup.update({ where: { id: groupId }, data: { status: "SEPARATE" } });
  revalidate(batchId);
}

type SnapshotRow = {
  id: string; data: RowData; action: RowAction; targetEmployeeId: string | null; mergedIntoRowId: string | null; skipReason: string | null;
};

export async function undoGroupDecision(batchId: string, groupId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const group = await db.importDuplicateGroup.findFirst({ where: { id: groupId, batchId } });
  if (!group) throw new Error("Group not found");
  if (group.status === "PENDING") return;
  await db.$transaction(async (tx) => {
    if (group.status === "MERGED" && group.snapshot) {
      for (const s of group.snapshot as SnapshotRow[]) {
        await tx.importRow.update({
          where: { id: s.id },
          data: {
            data: s.data as Prisma.InputJsonValue,
            action: s.action,
            targetEmployeeId: s.targetEmployeeId,
            mergedIntoRowId: s.mergedIntoRowId,
            skipReason: s.skipReason,
          },
        });
      }
    }
    await tx.importDuplicateGroup.update({
      where: { id: groupId },
      data: { status: "PENDING", primary: Prisma.JsonNull, snapshot: Prisma.JsonNull },
    });
  });
  revalidate(batchId);
}

export async function discardImportBatch(batchId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await db.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
  revalidate(batchId);
}

/** Apply the batch to the system (spec §4). Allowed only while every duplicate group and row is resolved. */
export async function commitImport(batchId: string): Promise<CommitSummary> {
  const session = await requireImportAccess();
  await requireEditableBatch(batchId);
  const detail = await getImportBatch(batchId);
  if (!detail) throw new Error("Import not found");
  const { needsDecision, needsAttention, newPeople, updates } = detail.stats;
  if (needsDecision > 0) {
    throw new Error(`${needsDecision} duplicate group${needsDecision === 1 ? " still needs" : "s still need"} a decision`);
  }
  if (needsAttention > 0) {
    throw new Error(`${needsAttention} row${needsAttention === 1 ? " has" : "s have"} errors to fix or skip`);
  }
  if (newPeople + updates === 0) throw new Error("Nothing to import — every row is skipped");

  const summary = await commitImportBatch(batchId, session.user.id);
  revalidatePath("/people");
  revalidatePath("/org");
  revalidate(batchId);
  return summary;
}
