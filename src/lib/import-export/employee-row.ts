import type { RowData } from "./types";

export interface EmployeeForRow {
  firstName: string; middleName: string | null; lastName: string; preferredName: string | null; pronouns: string | null;
  email: string; phone: string | null; jobTitle: string; location: string | null; status: string;
  startDate: Date | null; birthday: Date | null; anniversaryDate: Date | null; benefitsEligibleDate: Date | null;
  address: string | null; city: string | null; state: string | null; zipCode: string | null; country: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null; emergencyContactRelation: string | null;
  bio: string | null; hobbies: string | null; dietaryRestrictions: string | null; tShirtSize: string | null;
  department: { name: string } | null;
  team: { name: string } | null;
  manager: { firstName: string; lastName: string; preferredName: string | null } | null;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

/** Flatten an employee (with department/team/manager) into the same shape as an import row. */
export function employeeToRowData(e: EmployeeForRow): RowData {
  const out: RowData = {
    firstName: e.firstName, middleName: e.middleName ?? undefined, lastName: e.lastName,
    preferredName: e.preferredName ?? undefined, pronouns: e.pronouns ?? undefined,
    email: e.email, phone: e.phone ?? undefined, jobTitle: e.jobTitle, location: e.location ?? undefined, status: e.status,
    department: e.department?.name, team: e.team?.name,
    manager: e.manager ? `${e.manager.firstName} ${e.manager.lastName}`.trim() : undefined,
    startDate: iso(e.startDate), birthday: iso(e.birthday), anniversaryDate: iso(e.anniversaryDate), benefitsEligibleDate: iso(e.benefitsEligibleDate),
    address: e.address ?? undefined, city: e.city ?? undefined, state: e.state ?? undefined, zipCode: e.zipCode ?? undefined, country: e.country ?? undefined,
    emergencyContactName: e.emergencyContactName ?? undefined, emergencyContactPhone: e.emergencyContactPhone ?? undefined, emergencyContactRelation: e.emergencyContactRelation ?? undefined,
    bio: e.bio ?? undefined, hobbies: e.hobbies ?? undefined, dietaryRestrictions: e.dietaryRestrictions ?? undefined, tShirtSize: e.tShirtSize ?? undefined,
  };
  for (const k of Object.keys(out) as (keyof RowData)[]) {
    if (out[k] === undefined || out[k] === "") delete out[k];
  }
  return out;
}
