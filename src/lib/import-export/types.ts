export type FieldKey =
  | "firstName" | "middleName" | "lastName" | "preferredName" | "pronouns"
  | "email" | "phone"
  | "jobTitle" | "department" | "team" | "manager" | "status" | "location"
  | "startDate" | "birthday" | "anniversaryDate" | "benefitsEligibleDate"
  | "address" | "city" | "state" | "zipCode" | "country"
  | "emergencyContactName" | "emergencyContactPhone" | "emergencyContactRelation"
  | "bio" | "hobbies" | "dietaryRestrictions" | "tShirtSize";

export type FieldType = "text" | "email" | "phone" | "date" | "enum" | "relation";
export type FieldGroup = "Identity" | "Contact" | "Job" | "Dates" | "Address" | "Emergency" | "Personal";

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  type: FieldType;
  synonyms: string[];
  required?: boolean;
  enumValues?: readonly string[];
}

/** Cleaned values keyed by field. Dates are "YYYY-MM-DD". Empty strings are never stored. */
export type RowData = Partial<Record<FieldKey, string>>;

export type RowError = { field: FieldKey | "row"; message: string };

/** One entry per file column: the field it feeds, or "skip". */
export type ColumnMapping = (FieldKey | "skip")[];

export type MemberRef = { kind: "row"; id: string } | { kind: "employee"; id: string };

export type GroupReason = "email" | "phone" | "name";

export interface DetectedGroup {
  /** sorted member refs joined with "|" — stable across runs */
  key: string;
  reasons: GroupReason[];
  members: MemberRef[];
}

export interface RowLite {
  id: string;
  rowNumber: number;
  data: RowData;
}

export interface ExistingEmployeeLite {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
}

export type RowAction = "CREATE" | "UPDATE" | "SKIP" | "MERGED_AWAY";

export interface MergeMember {
  ref: MemberRef;
  rowNumber?: number;
  data: RowData;
}

export interface MergePlan {
  carrierRowId: string;
  action: "CREATE" | "UPDATE";
  targetEmployeeId: string | null;
  data: RowData;
  mergedAwayRowIds: string[];
}

export function refKey(ref: MemberRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function parseRefKey(key: string): MemberRef {
  const idx = key.indexOf(":");
  const kind = key.slice(0, idx) as MemberRef["kind"];
  return { kind, id: key.slice(idx + 1) };
}

export function sameRef(a: MemberRef, b: MemberRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** An existing employee flattened for the side-by-side comparison. */
export type EmployeeSnapshot = { id: string; name: string; status: string; archived: boolean; data: RowData };

/** Outcome of committing an import batch. */
export type CommitSummary = { created: number; updated: number; failed: number; warnings: number; invited: number };
export type CommitResult = "created" | "updated" | "failed";
