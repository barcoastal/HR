import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { FieldKey, RowData } from "./types";

// ---------------------------------------------------------------------------
// Field routing — every FieldKey must land in exactly one of these buckets.
// Shared by the import commit (create + update) and the employee merge.
// ---------------------------------------------------------------------------

export const TEXT_KEYS = [
  "firstName", "middleName", "lastName", "preferredName", "pronouns", "phone", "jobTitle", "location",
  "address", "city", "state", "zipCode", "country",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "bio", "hobbies", "dietaryRestrictions", "tShirtSize",
] as const;
export const DATE_KEYS = ["startDate", "birthday", "anniversaryDate", "benefitsEligibleDate"] as const;
type SpecialKey = "email" | "status" | "department" | "team" | "manager";
type Unhandled = Exclude<FieldKey, (typeof TEXT_KEYS)[number] | (typeof DATE_KEYS)[number] | SpecialKey>;
// Compile-time guard: adding a field to the registry without routing it here is a type error.
const _everyFieldRouted: Unhandled extends never ? true : never = true;
void _everyFieldRouted;

export type TextPatch = Partial<Record<(typeof TEXT_KEYS)[number], string>>;
export type DatePatch = Partial<Record<(typeof DATE_KEYS)[number], Date>>;

export function textFields(data: RowData): TextPatch {
  const out: TextPatch = {};
  for (const k of TEXT_KEYS) if (data[k] !== undefined) out[k] = data[k];
  return out;
}

export function dateFields(data: RowData): DatePatch {
  const out: DatePatch = {};
  for (const k of DATE_KEYS) if (data[k]) out[k] = new Date(data[k]!);
  return out;
}

// ---------------------------------------------------------------------------
// Departments / teams — created on demand, cached by lowercased name.
// ---------------------------------------------------------------------------

export type OrgResolver = {
  department(name: string): Promise<string>;
  team(name: string, departmentId: string): Promise<string>;
  /** Ids this resolver created on demand, in creation order — recorded so an import can be undone. */
  created: { departmentIds: string[]; teamIds: string[] };
};

export async function createOrgResolver(): Promise<OrgResolver> {
  const [departments, teams] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true } }),
    db.team.findMany({ select: { id: true, name: true, departmentId: true } }),
  ]);
  const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d.id]));
  const teamByKey = new Map(teams.map((t) => [`${t.departmentId}|${t.name.trim().toLowerCase()}`, t.id]));
  const created: OrgResolver["created"] = { departmentIds: [], teamIds: [] };

  return {
    created,
    async department(name: string): Promise<string> {
      const key = name.trim().toLowerCase();
      let id = deptByName.get(key);
      if (!id) {
        id = (await db.department.create({ data: { name: name.trim() }, select: { id: true } })).id;
        deptByName.set(key, id);
        created.departmentIds.push(id);
      }
      return id;
    },
    async team(name: string, departmentId: string): Promise<string> {
      const key = `${departmentId}|${name.trim().toLowerCase()}`;
      let id = teamByKey.get(key);
      if (!id) {
        id = (await db.team.create({ data: { name: name.trim(), departmentId }, select: { id: true } })).id;
        teamByKey.set(key, id);
        created.teamIds.push(id);
      }
      return id;
    },
  };
}

// ---------------------------------------------------------------------------
// UPDATE an existing person from row data (import UPDATE rows and employee merges)
// ---------------------------------------------------------------------------

export type EmployeeUpdateContext = {
  org: OrgResolver;
  /** Whether another person already uses this lowercased email. */
  isEmailTaken: (email: string) => boolean | Promise<boolean>;
};

export type EmployeeUpdatePlan = {
  patch: Prisma.EmployeeUncheckedUpdateInput;
  /** Human-readable reasons a value was not applied. */
  notes: string[];
};

/**
 * Turn row data into a Prisma update for an existing person, applying the import rules:
 * only present keys are written; `status` never changes; `email` changes only when no login is
 * bound to the current address and nobody else uses the new one; departments/teams are created
 * on demand. `manager` is left to the caller (it needs the whole people list to resolve).
 */
export async function employeeUpdateFromRowData(
  current: { id: string; email: string; status: string; departmentId: string | null },
  data: RowData,
  ctx: EmployeeUpdateContext,
): Promise<EmployeeUpdatePlan> {
  const notes: string[] = [];
  const patch: Prisma.EmployeeUncheckedUpdateInput = { ...textFields(data), ...dateFields(data) };

  if (data.email) {
    const next = data.email.toLowerCase();
    if (next !== current.email.toLowerCase()) {
      const login = await db.user.findUnique({ where: { email: current.email }, select: { id: true } });
      if (login) notes.push("Email kept — it's the login");
      else if (await ctx.isEmailTaken(next)) notes.push("Email kept — the new one is already used by someone else");
      else patch.email = next;
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

  return { patch, notes };
}
