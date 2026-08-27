import { Prisma, type Employee, type EmployeeStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isJobTitleEligibleForTraining } from "@/lib/training-eligibility-server";
import { audit } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { loadEmployeesLite } from "./batch-service";
import {
  createOrgResolver, DATE_KEYS, dateFields, employeeUpdateFromRowData, TEXT_KEYS, textFields, type OrgResolver,
} from "./employee-write";
import { matchManager, type ManagerCandidate } from "./manager-match";
import type { CommitResult, CommitSummary, CreateSnapshot, RowData, RowSnapshot } from "./types";

export type { CommitSummary, CommitResult };

/** Today at UTC midnight — dates are stored date-only, matching the "YYYY-MM-DD" row values. */
function today(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

function placeholderEmail(first: string, last: string): string {
  return `${first}.${last}@pending.local`.toLowerCase().replace(/\s+/g, "");
}

function errorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") return "Email already in use";
  return err instanceof Error ? err.message : "Something went wrong";
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

type Ctx = {
  batchId: string;
  org: OrgResolver;
  /** Every employee that can be a manager: existing (archived included) plus the ones created here. */
  candidates: Map<string, ManagerCandidate>;
  takenEmails: Set<string>;
  summary: CommitSummary;
};

type Outcome = {
  result: CommitResult;
  employeeId: string | null;
  notes: string[];
  /** Undo bookkeeping, persisted as ImportRow.previous. */
  previous: RowSnapshot | CreateSnapshot | null;
  /** UPDATE rows: the manager before this import — copied into `previous` if pass 2 replaces it. */
  managerBefore?: string | null;
};

type LoginOutcome = { invited: boolean; snapshot: CreateSnapshot };

/**
 * Copied from approveAndInviteEmployee: create/link the login, then send the welcome email. The snapshot
 * records whether the login was made here or merely linked, so undo knows whether it may delete it.
 */
async function ensureLoginAndInvite(employee: { id: string; email: string }, notes: string[]): Promise<LoginOutcome> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const snapshot: CreateSnapshot = { loginCreated: false };
  const existingUser = await db.user.findUnique({ where: { email: employee.email } });
  if (!existingUser) {
    await db.user.create({ data: { email: employee.email, role: "EMPLOYEE", employeeId: employee.id } });
    snapshot.loginCreated = true;
  } else if (!existingUser.employeeId) {
    await db.user.update({ where: { id: existingUser.id }, data: { employeeId: employee.id } });
    snapshot.linkedUserId = existingUser.id;
  } else if (existingUser.employeeId !== employee.id) {
    notes.push(`A login for ${employee.email} already belongs to someone else — no invite sent`);
    return { invited: false, snapshot };
  }
  try {
    await sendWelcomeEmail({ to: employee.email, role: "Employee", loginUrl: `${baseUrl}/login` });
  } catch (err) {
    console.error("[import] welcome email failed:", employee.email, err);
    notes.push("Login created, but the welcome email could not be sent");
  }
  return { invited: true, snapshot };
}

type Created = { employeeId: string; previous: CreateSnapshot };
type Updated = { employeeId: string; previous: RowSnapshot; managerBefore: string | null };

async function createEmployee(row: { rowNumber: number }, data: RowData, notes: string[], ctx: Ctx): Promise<Created> {
  const firstName = data.firstName ?? "";
  const lastName = data.lastName ?? "";
  const hasEmail = !!data.email;
  const email = (data.email ?? placeholderEmail(firstName, lastName)).toLowerCase();
  if (ctx.takenEmails.has(email)) throw new Error("Email already in use");

  let status = (data.status ?? "PENDING") as EmployeeStatus;
  if (status !== "PENDING" && !hasEmail) {
    // Without a real address there is nothing to invite; a non-pending person with no login would
    // also be hidden from the People page.
    notes.push(`No email — created as Pending instead of ${status}`);
    status = "PENDING";
  }

  const departmentId = data.department ? await ctx.org.department(data.department) : undefined;
  let teamId: string | undefined;
  if (data.team) {
    if (departmentId) teamId = await ctx.org.team(data.team, departmentId);
    else notes.push(`Team "${data.team}" skipped — no department on this row`);
  }

  const dates = dateFields(data);
  const startDate = dates.startDate ?? today();
  const jobTitle = data.jobTitle ?? "Employee";
  // Titles marked for training in Settings route to Training automatically when entering the onboarding workflow.
  const requiresTraining = status === "ONBOARDING" || status === "PRE_ONBOARDING" || status === "TRAINING"
    ? await isJobTitleEligibleForTraining(jobTitle)
    : false;
  const employee = await db.employee.create({
    data: {
      ...textFields(data),
      ...dates,
      firstName,
      lastName,
      email,
      jobTitle,
      requiresTraining,
      status,
      startDate,
      anniversaryDate: dates.anniversaryDate ?? startDate,
      departmentId,
      teamId,
    },
    select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
  });
  ctx.takenEmails.add(email);
  ctx.candidates.set(employee.id, employee);

  let previous: CreateSnapshot = { loginCreated: false };
  if (status !== "PENDING") {
    const login = await ensureLoginAndInvite(employee, notes);
    previous = login.snapshot;
    if (login.invited) ctx.summary.invited++;
  }

  await audit({
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    details: { via: "import", batchId: ctx.batchId, rowNumber: row.rowNumber, name: `${firstName} ${lastName}`, email, status },
  });
  return { employeeId: employee.id, previous };
}

/** The values `patch` is about to overwrite, in the shape undo restores from. */
function snapshotBefore(current: Employee, patch: Prisma.EmployeeUncheckedUpdateInput): RowSnapshot {
  const previous: RowSnapshot = {};
  for (const k of TEXT_KEYS) if (k in patch) previous[k] = current[k] ?? null;
  for (const k of DATE_KEYS) if (k in patch) previous[k] = current[k]?.toISOString().slice(0, 10) ?? null;
  if ("email" in patch) previous.email = current.email;
  if ("departmentId" in patch) previous._departmentId = current.departmentId;
  if ("teamId" in patch) previous._teamId = current.teamId;
  return previous;
}

async function updateEmployee(
  row: { rowNumber: number; targetEmployeeId: string | null },
  data: RowData,
  notes: string[],
  ctx: Ctx,
): Promise<Updated> {
  if (!row.targetEmployeeId) throw new Error("No existing person is linked to this row");
  // findUnique is not subject to the archived-employee filter in db.ts, so archived targets still resolve.
  const current = await db.employee.findUnique({ where: { id: row.targetEmployeeId } });
  if (!current) throw new Error("The linked person no longer exists");

  const { patch, notes: updateNotes } = await employeeUpdateFromRowData(current, data, {
    org: ctx.org,
    isEmailTaken: (email) => ctx.takenEmails.has(email),
  });
  notes.push(...updateNotes);
  if (typeof patch.email === "string") {
    ctx.takenEmails.delete(current.email.toLowerCase());
    ctx.takenEmails.add(patch.email);
  }
  const previous = snapshotBefore(current, patch);

  const updated = await db.employee.update({
    where: { id: current.id },
    data: patch,
    select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
  });
  ctx.candidates.set(updated.id, updated);

  await audit({
    action: "employee.updated",
    entityType: "employee",
    entityId: current.id,
    details: { via: "import", batchId: ctx.batchId, rowNumber: row.rowNumber, fields: Object.keys(patch) },
  });
  return { employeeId: current.id, previous, managerBefore: current.managerId };
}

async function writeOutcome(rowId: string, outcome: Outcome) {
  await db.importRow.update({
    where: { id: rowId },
    data: {
      result: outcome.result,
      resultEmployeeId: outcome.employeeId,
      resultNotes: outcome.notes as Prisma.InputJsonValue,
      previous: outcome.previous === null ? Prisma.DbNull : (outcome.previous as Prisma.InputJsonValue),
    },
  });
}

/**
 * Apply a reviewed batch to the system (spec §4). Rows are committed one at a time and a failing
 * row never rolls back the others; every row records its result, the person it produced, and any
 * warnings. Managers are linked in a second pass so rows can reference people created by the
 * same file.
 */
export async function commitImportBatch(batchId: string, actorUserId: string): Promise<CommitSummary> {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { where: { action: { in: ["CREATE", "UPDATE"] } }, orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) throw new Error("Import not found");
  if (batch.status !== "REVIEWING") {
    throw new Error(batch.status === "IMPORTED" ? "This import has already been imported" : "This import was discarded");
  }

  const existing = await loadEmployeesLite();
  const ctx: Ctx = {
    batchId,
    org: await createOrgResolver(),
    candidates: new Map(existing.map((e) => [e.id, e])),
    takenEmails: new Set(existing.map((e) => e.email.toLowerCase())),
    summary: { created: 0, updated: 0, failed: 0, warnings: 0, invited: 0 },
  };
  const outcomes = new Map<string, Outcome>();

  // Pass 1: people.
  for (const row of batch.rows) {
    const data = row.data as RowData;
    const notes: string[] = [];
    let outcome: Outcome;
    try {
      const applied = row.action === "CREATE"
        ? await createEmployee(row, data, notes, ctx)
        : await updateEmployee(row, data, notes, ctx);
      outcome = { result: row.action === "CREATE" ? "created" : "updated", notes, ...applied };
    } catch (err) {
      console.error(`[import] row ${row.rowNumber} failed:`, err);
      outcome = { result: "failed", employeeId: null, notes: [...notes, errorMessage(err)], previous: null };
    }
    outcomes.set(row.id, outcome);
    await writeOutcome(row.id, outcome);
  }

  // Pass 2: managers, against existing people plus everyone created above.
  const people = Array.from(ctx.candidates.values());
  for (const row of batch.rows) {
    const outcome = outcomes.get(row.id)!;
    const reference = (row.data as RowData).manager;
    if (!reference || !outcome.employeeId) continue;
    try {
      const match = matchManager(reference, people);
      if ("id" in match) {
        if (match.id === outcome.employeeId) {
          outcome.notes.push(`Manager "${reference}" is this person — left blank`);
        } else {
          await db.employee.update({ where: { id: outcome.employeeId }, data: { managerId: match.id } });
          // Only now did the import touch the manager, so only now does undo need the old one.
          if (outcome.result === "updated") (outcome.previous as RowSnapshot)._managerId = outcome.managerBefore ?? null;
        }
      } else if (match.error === "none") {
        outcome.notes.push(`Manager "${reference}" not found`);
      } else {
        outcome.notes.push(`Manager "${reference}" matches more than one person`);
      }
    } catch (err) {
      outcome.notes.push(`Manager "${reference}" could not be set: ${errorMessage(err)}`);
    }
    await writeOutcome(row.id, outcome);
  }

  for (const o of outcomes.values()) {
    if (o.result === "created") ctx.summary.created++;
    else if (o.result === "updated") ctx.summary.updated++;
    else ctx.summary.failed++;
    if (o.result !== "failed") ctx.summary.warnings += o.notes.length;
  }
  const summary: CommitSummary = {
    ...ctx.summary,
    createdDepartmentIds: ctx.org.created.departmentIds,
    createdTeamIds: ctx.org.created.teamIds,
  };

  await db.importBatch.update({
    where: { id: batchId },
    data: { status: "IMPORTED", importedAt: new Date(), summary: summary as Prisma.InputJsonValue },
  });
  await audit({
    action: "import.completed",
    entityType: "import_batch",
    entityId: batchId,
    details: { fileName: batch.fileName, actorUserId, ...summary },
  });
  return summary;
}
