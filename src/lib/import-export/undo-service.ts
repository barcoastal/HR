import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DATE_KEYS, TEXT_KEYS } from "./employee-write";
import { UNDO_NOTE_PREFIX, type CommitSummary, type CreateSnapshot, type RowSnapshot, type UndoSummary } from "./types";

type UndoRow = { id: string; rowNumber: number; result: string | null; resultEmployeeId: string | null; resultNotes: unknown; previous: unknown };
type RowOutcome = "deleted" | "restored" | "skipped";

function errorMessage(err: unknown): string {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  if (code === "P2003") return "still referenced by other records (messages, channels or alerts) — remove those first";
  if (code === "P2002") return "a unique value (such as the email) is already in use";
  return err instanceof Error ? err.message : "Something went wrong";
}

// ---------------------------------------------------------------------------
// CREATE rows → delete the person and the login the import made
// ---------------------------------------------------------------------------

async function deleteCreatedPerson(row: UndoRow, batchId: string, notes: string[]): Promise<RowOutcome> {
  if (!row.resultEmployeeId) {
    notes.push("skipped — no person was recorded for this row");
    return "skipped";
  }
  // findUnique bypasses the archived filter in db.ts, so archived people are found and reported rather than deleted.
  const employee = await db.employee.findUnique({
    where: { id: row.resultEmployeeId },
    select: { id: true, firstName: true, lastName: true, email: true, archivedAt: true },
  });
  if (!employee) {
    notes.push("skipped — already deleted (merged or removed since the import)");
    return "skipped";
  }
  if (employee.archivedAt) {
    notes.push("skipped — archived since the import, left in the archive");
    return "skipped";
  }

  const snapshot = (row.previous as CreateSnapshot | null) ?? null;
  const loginsDeleted = await db.$transaction(async (tx) => {
    // A login that existed before the import was only linked to this person — give it back rather than delete it.
    if (snapshot?.linkedUserId) {
      await tx.user.updateMany({ where: { id: snapshot.linkedUserId, employeeId: employee.id }, data: { employeeId: null } });
    }
    const logins = await tx.user.deleteMany({ where: { employeeId: employee.id } });
    // Everything hanging off the person cascades or nulls out per the schema; chat content they authored blocks the delete.
    await tx.employee.delete({ where: { id: employee.id } });
    return logins.count;
  });

  notes.push(loginsDeleted > 0 ? "deleted, along with their login" : "deleted");
  if (snapshot?.linkedUserId) notes.push("their pre-existing login was kept and unlinked");
  await audit({
    action: "employee.deleted",
    entityType: "employee",
    entityId: employee.id,
    details: {
      via: "import-undo",
      batchId,
      rowNumber: row.rowNumber,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      loginsDeleted,
    },
  });
  return "deleted";
}

// ---------------------------------------------------------------------------
// UPDATE rows → put the overwritten values back
// ---------------------------------------------------------------------------

/** Turn a snapshot into an update, checking that every linked record it points at still exists. */
async function restorePatch(snapshot: RowSnapshot, employeeId: string, notes: string[]) {
  const data: Prisma.EmployeeUncheckedUpdateInput = {};
  const fields: string[] = [];

  for (const k of TEXT_KEYS) {
    if (!(k in snapshot)) continue;
    const value = snapshot[k] ?? null;
    // Required columns can't be emptied; the snapshot never holds null for them anyway.
    if (k === "firstName" || k === "lastName" || k === "jobTitle") {
      if (value) data[k] = value;
    } else {
      data[k] = value;
    }
    fields.push(k);
  }
  for (const k of DATE_KEYS) {
    if (!(k in snapshot)) continue;
    const value = snapshot[k] ? new Date(snapshot[k]!) : null;
    if (k === "startDate") {
      if (value) data.startDate = value;
    } else {
      data[k] = value;
    }
    fields.push(k);
  }

  if ("email" in snapshot && snapshot.email) {
    const holder = await db.employee.findUnique({ where: { email: snapshot.email }, select: { id: true } });
    if (holder && holder.id !== employeeId) notes.push(`email not restored — ${snapshot.email} now belongs to someone else`);
    else {
      data.email = snapshot.email;
      fields.push("email");
    }
  }

  if ("_departmentId" in snapshot) {
    const id = snapshot._departmentId ?? null;
    const exists = id ? await db.department.findUnique({ where: { id }, select: { id: true } }) : null;
    if (id && !exists) notes.push("department cleared — the previous one no longer exists");
    data.departmentId = exists ? id : null;
    fields.push("department");
  }
  if ("_teamId" in snapshot) {
    const id = snapshot._teamId ?? null;
    const exists = id ? await db.team.findUnique({ where: { id }, select: { id: true } }) : null;
    if (id && !exists) notes.push("team cleared — the previous one no longer exists");
    data.teamId = exists ? id : null;
    fields.push("team");
  }
  if ("_managerId" in snapshot) {
    const id = snapshot._managerId ?? null;
    const exists = id ? await db.employee.findUnique({ where: { id }, select: { id: true } }) : null;
    if (id && !exists) notes.push("manager cleared — the previous one no longer exists");
    data.managerId = exists ? id : null;
    fields.push("manager");
  }

  return { data, fields };
}

async function restoreUpdatedPerson(row: UndoRow, batchId: string, notes: string[]): Promise<RowOutcome> {
  if (!row.resultEmployeeId) {
    notes.push("skipped — no person was recorded for this row");
    return "skipped";
  }
  const snapshot = (row.previous as RowSnapshot | null) ?? null;
  if (!snapshot) {
    notes.push("skipped — no snapshot (this import predates undo), the update was left in place");
    return "skipped";
  }
  const employee = await db.employee.findUnique({ where: { id: row.resultEmployeeId }, select: { id: true, archivedAt: true } });
  if (!employee) {
    notes.push("skipped — already deleted (merged or removed since the import)");
    return "skipped";
  }

  const { data, fields } = await restorePatch(snapshot, employee.id, notes);
  if (fields.length === 0) {
    notes.push("nothing to restore");
    return "restored";
  }
  await db.employee.update({ where: { id: employee.id }, data });
  notes.push(`restored ${fields.join(", ")}${employee.archivedAt ? " (person is archived)" : ""}`);
  await audit({
    action: "employee.updated",
    entityType: "employee",
    entityId: employee.id,
    details: { via: "import-undo", batchId, rowNumber: row.rowNumber, fields },
  });
  return "restored";
}

// ---------------------------------------------------------------------------
// Departments / teams the import created → removed if nothing uses them any more
// ---------------------------------------------------------------------------

async function removeEmptyTeams(ids: string[]): Promise<number> {
  let removed = 0;
  for (const id of ids) {
    const team = await db.team.findUnique({ where: { id }, select: { _count: { select: { employees: true } } } });
    // Relation counts see archived people too, so a team holding only archived members stays.
    if (!team || team._count.employees > 0) continue;
    await db.team.delete({ where: { id } });
    removed++;
  }
  return removed;
}

async function removeEmptyDepartments(ids: string[]): Promise<number> {
  let removed = 0;
  for (const id of ids) {
    const dept = await db.department.findUnique({
      where: { id },
      select: {
        headId: true,
        reviewTemplate: { select: { id: true } },
        _count: {
          select: {
            employees: true, teams: true, positions: true, checklists: true, children: true,
            assignedChecklistItems: true, assignedEmployeeTasks: true, reviewCycles: true,
          },
        },
      },
    });
    if (!dept) continue;
    const referenced = !!dept.headId || !!dept.reviewTemplate || Object.values(dept._count).some((n) => n > 0);
    if (referenced) continue;
    await db.department.delete({ where: { id } });
    removed++;
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

async function appendNotes(row: UndoRow, notes: string[]) {
  const existing = (row.resultNotes as string[] | null) ?? [];
  await db.importRow.update({
    where: { id: row.id },
    data: { resultNotes: [...existing, ...notes.map((n) => `${UNDO_NOTE_PREFIX}${n}`)] as Prisma.InputJsonValue },
  });
}

/**
 * Reverse a committed import: delete the people it created (with the logins it made), put updated
 * people back to their pre-import values from the row snapshots, and drop the departments/teams it
 * created if nothing else uses them. Rows are undone one at a time — a failing row is noted and
 * skipped, never rolled back with the others — and every outcome is appended to the row's notes.
 */
export async function undoImportBatch(batchId: string, actorUserId: string): Promise<UndoSummary> {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { where: { result: { in: ["created", "updated"] } }, orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) throw new Error("Import not found");
  if (batch.status === "UNDONE") throw new Error("This import has already been undone");
  if (batch.status !== "IMPORTED") throw new Error("Only an imported batch can be undone");

  const summary: CommitSummary = (batch.summary as CommitSummary | null) ?? { created: 0, updated: 0, failed: 0, warnings: 0, invited: 0 };
  const undo: UndoSummary = { deleted: 0, restored: 0, skipped: 0, departmentsRemoved: 0, teamsRemoved: 0 };

  // Restore updates before deleting created people so a restored manager link is never nulled out by a cascade.
  const rows = [...batch.rows.filter((r) => r.result === "updated"), ...batch.rows.filter((r) => r.result === "created")];
  for (const row of rows) {
    const notes: string[] = [];
    let outcome: RowOutcome;
    try {
      outcome = row.result === "created"
        ? await deleteCreatedPerson(row, batchId, notes)
        : await restoreUpdatedPerson(row, batchId, notes);
    } catch (err) {
      console.error(`[import-undo] row ${row.rowNumber} failed:`, err);
      notes.push(`failed — ${errorMessage(err)}`);
      outcome = "skipped";
    }
    undo[outcome]++;
    await appendNotes(row, notes);
  }

  // Teams first: a department is only empty once its import-created teams are gone.
  undo.teamsRemoved = await removeEmptyTeams(summary.createdTeamIds ?? []);
  undo.departmentsRemoved = await removeEmptyDepartments(summary.createdDepartmentIds ?? []);

  await db.importBatch.update({
    where: { id: batchId },
    data: { status: "UNDONE", undoneAt: new Date(), summary: { ...summary, undo } as Prisma.InputJsonValue },
  });
  await audit({
    action: "import.undone",
    entityType: "import_batch",
    entityId: batchId,
    details: { fileName: batch.fileName, actorUserId, ...undo },
  });
  return undo;
}
