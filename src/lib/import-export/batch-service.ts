import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { autoDetectMapping } from "./employee-fields";
import { applyMapping, validateRow } from "./normalize";
import { detectDuplicates, groupKey } from "./duplicates";
import { employeeToRowData } from "./employee-row";
import { refKey, type ColumnMapping, type EmployeeSnapshot, type ExistingEmployeeLite, type MemberRef, type RowData, type RowLite } from "./types";

export type { EmployeeSnapshot };


const LITE_SELECT = { id: true, firstName: true, lastName: true, preferredName: true, email: true, phone: true } as const;

/** Every employee, archived included (db.ts hides archived rows unless archivedAt is set explicitly). */
export async function loadEmployeesLite(): Promise<ExistingEmployeeLite[]> {
  const [active, archived] = await Promise.all([
    db.employee.findMany({ select: LITE_SELECT }),
    db.employee.findMany({ where: { archivedAt: { not: null } }, select: LITE_SELECT }),
  ]);
  return [...active, ...archived];
}

const SNAPSHOT_INCLUDE = {
  department: { select: { name: true } },
  team: { select: { name: true } },
  manager: { select: { firstName: true, lastName: true, preferredName: true } },
} as const;

/** Full field snapshots (for the side-by-side view) of the given employees, archived included. */
export async function loadEmployeeSnapshots(ids: string[]): Promise<Record<string, EmployeeSnapshot>> {
  if (ids.length === 0) return {};
  const [active, archived] = await Promise.all([
    db.employee.findMany({ where: { id: { in: ids } }, include: SNAPSHOT_INCLUDE }),
    db.employee.findMany({ where: { id: { in: ids }, archivedAt: { not: null } }, include: SNAPSHOT_INCLUDE }),
  ]);
  const out: Record<string, EmployeeSnapshot> = {};
  for (const e of [...active, ...archived]) {
    out[e.id] = {
      id: e.id,
      name: `${e.preferredName || e.firstName} ${e.lastName}`.trim(),
      status: e.status,
      archived: e.archivedAt !== null,
      data: employeeToRowData(e),
    };
  }
  return out;
}

export async function createBatchFromUpload(args: {
  fileName: string;
  fileType: "csv" | "xlsx";
  headers: string[];
  rows: string[][];
  uploadedById: string;
}): Promise<string> {
  const mapping = autoDetectMapping(args.headers);
  const batch = await db.importBatch.create({
    data: {
      fileName: args.fileName,
      fileType: args.fileType,
      headers: args.headers as Prisma.InputJsonValue,
      mapping: mapping as Prisma.InputJsonValue,
      rowCount: args.rows.length,
      uploadedById: args.uploadedById,
    },
  });
  await db.importRow.createMany({
    data: args.rows.map((raw, i) => ({
      batchId: batch.id,
      rowNumber: i + 1,
      raw: raw as Prisma.InputJsonValue,
      data: {} as Prisma.InputJsonValue,
      errors: [] as Prisma.InputJsonValue,
    })),
  });
  return batch.id;
}

/** Re-derive every row's data/errors/action from the batch mapping, then run detection from scratch. */
export async function rebuildBatchRows(batchId: string): Promise<void> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId }, include: { rows: true } });
  if (!batch) throw new Error("Import not found");
  const mapping = (batch.mapping as ColumnMapping | null) ?? autoDetectMapping(batch.headers as string[]);

  await db.$transaction(async (tx) => {
    for (const row of batch.rows) {
      const { data, errors } = validateRow(applyMapping(row.raw as string[], mapping));
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          data: data as Prisma.InputJsonValue,
          errors: errors as Prisma.InputJsonValue,
          action: errors.length > 0 ? "SKIP" : "CREATE",
          skipReason: errors.length > 0 ? "invalid" : null,
          targetEmployeeId: null,
          mergedIntoRowId: null,
        },
      });
    }
    await tx.importDuplicateGroup.deleteMany({ where: { batchId } });
  });
  await runBatchDetection(batchId, { keepMerged: false });
}

/**
 * Recompute duplicate groups. With keepMerged, rows and employees that belong to a MERGED group are
 * excluded from detection and those groups are left untouched; SEPARATE decisions survive when a
 * detected group has exactly the same members as before.
 */
export async function runBatchDetection(batchId: string, opts: { keepMerged: boolean }): Promise<void> {
  const [rows, groups, employees] = await Promise.all([
    db.importRow.findMany({ where: { batchId } }),
    db.importDuplicateGroup.findMany({ where: { batchId } }),
    loadEmployeesLite(),
  ]);

  const merged = opts.keepMerged ? groups.filter((g) => g.status === "MERGED") : [];
  const excluded = new Set<string>();
  for (const g of merged) for (const m of g.members as MemberRef[]) excluded.add(refKey(m));

  const liveRows: RowLite[] = rows
    .filter((r) => (r.action === "CREATE" || r.action === "UPDATE") && !excluded.has(refKey({ kind: "row", id: r.id })))
    .map((r) => ({ id: r.id, rowNumber: r.rowNumber, data: r.data as RowData }));
  const candidates = employees.filter((e) => !excluded.has(refKey({ kind: "employee", id: e.id })));

  const detected = detectDuplicates(liveRows, candidates);
  const previousSeparate = new Set(
    groups.filter((g) => g.status === "SEPARATE").map((g) => groupKey(g.members as MemberRef[])),
  );
  const keepIds = Array.from(new Set(merged.map((g) => g.id)));

  await db.$transaction(async (tx) => {
    await tx.importDuplicateGroup.deleteMany({ where: { batchId, id: { notIn: keepIds } } });
    // createMany does not guarantee insertion order is preserved on read, so stamp createdAt explicitly.
    const base = Date.now();
    for (let i = 0; i < detected.length; i++) {
      const g = detected[i];
      await tx.importDuplicateGroup.create({
        data: {
          batchId,
          status: previousSeparate.has(g.key) ? "SEPARATE" : "PENDING",
          reasons: g.reasons as unknown as Prisma.InputJsonValue,
          members: g.members as unknown as Prisma.InputJsonValue,
          createdAt: new Date(base + i),
        },
      });
    }
  });
}
