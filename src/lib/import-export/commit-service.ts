import { Prisma, type EmployeeStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { loadEmployeesLite } from "./batch-service";
import { matchManager, type ManagerCandidate } from "./manager-match";
import type { FieldKey, RowData } from "./types";
import type { CommitSummary, CommitResult } from "./types";

export type { CommitSummary, CommitResult };

// ---------------------------------------------------------------------------
// Field routing — every FieldKey must land in exactly one of these buckets.
// ---------------------------------------------------------------------------

const TEXT_KEYS = [
  "firstName", "middleName", "lastName", "preferredName", "pronouns", "phone", "jobTitle", "location",
  "address", "city", "state", "zipCode", "country",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "bio", "hobbies", "dietaryRestrictions", "tShirtSize",
] as const;
const DATE_KEYS = ["startDate", "birthday", "anniversaryDate", "benefitsEligibleDate"] as const;
type SpecialKey = "email" | "status" | "department" | "team" | "manager";
type Unhandled = Exclude<FieldKey, (typeof TEXT_KEYS)[number] | (typeof DATE_KEYS)[number] | SpecialKey>;
// Compile-time guard: adding a field to the registry without routing it here is a type error.
const _everyFieldRouted: Unhandled extends never ? true : never = true;
void _everyFieldRouted;

type TextPatch = Partial<Record<(typeof TEXT_KEYS)[number], string>>;
type DatePatch = Partial<Record<(typeof DATE_KEYS)[number], Date>>;

function textFields(data: RowData): TextPatch {
  const out: TextPatch = {};
  for (const k of TEXT_KEYS) if (data[k] !== undefined) out[k] = data[k];
  return out;
}

function dateFields(data: RowData): DatePatch {
  const out: DatePatch = {};
  for (const k of DATE_KEYS) if (data[k]) out[k] = new Date(data[k]!);
  return out;
}

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
// Departments / teams — created on demand, cached by lowercased name.
// ---------------------------------------------------------------------------

async function createOrgResolver() {
  const [departments, teams] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true } }),
    db.team.findMany({ select: { id: true, name: true, departmentId: true } }),
  ]);
  const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const teamByKey = new Map(teams.map((t) => [`${t.departmentId}|${t.name.trim().toLowerCase()}`, t.id]));

  return {
    async department(name: string): Promise<string> {
      const key = name.trim().toLowerCase();
      let id = deptByName.get(key);
      if (!id) {
        id = (await db.department.create({ data: { name: name.trim() }, select: { id: true } })).id;
        deptByName.set(key, id);
      }
      return id;
    },
    async team(name: string, departmentId: string): Promise<string> {
      const key = `${departmentId}|${name.trim().toLowerCase()}`;
      let id = teamByKey.get(key);
      if (!id) {
        id = (await db.team.create({ data: { name: name.trim(), departmentId }, select: { id: true } })).id;
        teamByKey.set(key, id);
      }
      return id;
    },
  };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

type Ctx = {
  batchId: string;
  org: Awaited<ReturnType<typeof createOrgResolver>>;
  /** Every employee that can be a manager: existing (archived included) plus the ones created here. */
  candidates: Map<string, ManagerCandidate>;
  takenEmails: Set<string>;
  summary: CommitSummary;
};

type Outcome = { result: CommitResult; employeeId: string | null; notes: string[] };

/** Copied from approveAndInviteEmployee: create/link the login, then send the welcome email. Returns true when invited. */
async function ensureLoginAndInvite(employee: { id: string; email: string }, notes: string[]): Promise<boolean> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const existingUser = await db.user.findUnique({ where: { email: employee.email } });
  if (!existingUser) {
    await db.user.create({ data: { email: employee.email, role: "EMPLOYEE", employeeId: employee.id } });
  } else if (!existingUser.employeeId) {
    await db.user.update({ where: { id: existingUser.id }, data: { employeeId: employee.id } });
  } else if (existingUser.employeeId !== employee.id) {
    notes.push(`A login for ${employee.email} already belongs to someone else — no invite sent`);
    return false;
  }
  try {
    await sendWelcomeEmail({ to: employee.email, role: "Employee", loginUrl: `${baseUrl}/login` });
  } catch (err) {
    console.error("[import] welcome email failed:", employee.email, err);
    notes.push("Login created, but the welcome email could not be sent");
  }
  return true;
}

async function createEmployee(row: { rowNumber: number }, data: RowData, notes: string[], ctx: Ctx): Promise<string> {
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
  const employee = await db.employee.create({
    data: {
      ...textFields(data),
      ...dates,
      firstName,
      lastName,
      email,
      jobTitle: data.jobTitle ?? "Employee",
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

  if (status !== "PENDING" && (await ensureLoginAndInvite(employee, notes))) ctx.summary.invited++;

  await audit({
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    details: { via: "import", batchId: ctx.batchId, rowNumber: row.rowNumber, name: `${firstName} ${lastName}`, email, status },
  });
  return employee.id;
}

async function updateEmployee(
  row: { rowNumber: number; targetEmployeeId: string | null },
  data: RowData,
  notes: string[],
  ctx: Ctx,
): Promise<string> {
  if (!row.targetEmployeeId) throw new Error("No existing person is linked to this row");
  // findUnique is not subject to the archived-employee filter in db.ts, so archived targets still resolve.
  const current = await db.employee.findUnique({ where: { id: row.targetEmployeeId } });
  if (!current) throw new Error("The linked person no longer exists");

  const patch: Prisma.EmployeeUncheckedUpdateInput = { ...textFields(data), ...dateFields(data) };

  if (data.email) {
    const next = data.email.toLowerCase();
    if (next !== current.email.toLowerCase()) {
      const login = await db.user.findUnique({ where: { email: current.email }, select: { id: true } });
      if (login) notes.push("Email kept — it's the login");
      else if (ctx.takenEmails.has(next)) notes.push("Email kept — the new one is already used by someone else");
      else {
        patch.email = next;
        ctx.takenEmails.delete(current.email.toLowerCase());
        ctx.takenEmails.add(next);
      }
    }
  }
  if (data.status && data.status !== current.status) {
    notes.push(`Status kept as ${current.status} — updates never change status`);
  }

  if (data.department) patch.departmentId = await ctx.org.department(data.department);
  if (data.team) {
    const departmentId = (patch.departmentId as string | undefined) ?? current.departmentId;
    if (departmentId) patch.teamId = await ctx.org.team(data.team, departmentId);
    else notes.push(`Team "${data.team}" skipped — this person has no department`);
  }

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
  return current.id;
}

async function writeOutcome(rowId: string, outcome: Outcome) {
  await db.importRow.update({
    where: { id: rowId },
    data: {
      result: outcome.result,
      resultEmployeeId: outcome.employeeId,
      resultNotes: outcome.notes as Prisma.InputJsonValue,
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
      const employeeId = row.action === "CREATE"
        ? await createEmployee(row, data, notes, ctx)
        : await updateEmployee(row, data, notes, ctx);
      outcome = { result: row.action === "CREATE" ? "created" : "updated", employeeId, notes };
    } catch (err) {
      console.error(`[import] row ${row.rowNumber} failed:`, err);
      outcome = { result: "failed", employeeId: null, notes: [...notes, errorMessage(err)] };
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
        if (match.id === outcome.employeeId) outcome.notes.push(`Manager "${reference}" is this person — left blank`);
        else await db.employee.update({ where: { id: outcome.employeeId }, data: { managerId: match.id } });
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
  const summary = ctx.summary;

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
