import { FIELD_KEYS } from "./employee-fields";
import { sameRef, type FieldKey, type MemberRef, type MergeMember, type MergePlan, type RowData } from "./types";

function valueOf(members: MergeMember[], ref: MemberRef, key: FieldKey): string | undefined {
  const m = members.find((x) => sameRef(x.ref, ref));
  const v = m?.data[key];
  return v && v.trim() ? v : undefined;
}

/** Primary's value wins; blanks are filled from the other members in order. */
export function defaultFieldChoices(members: MergeMember[], primary: MemberRef): Partial<Record<FieldKey, MemberRef>> {
  const choices: Partial<Record<FieldKey, MemberRef>> = {};
  for (const key of FIELD_KEYS) {
    if (valueOf(members, primary, key) !== undefined) { choices[key] = primary; continue; }
    const donor = members.find((m) => valueOf(members, m.ref, key) !== undefined);
    if (donor) choices[key] = donor.ref;
  }
  return choices;
}

/** The merged values: for every field, the value of the chosen member (defaults fill the gaps). */
function pickMergedData(members: MergeMember[], primary: MemberRef, choices: Partial<Record<FieldKey, MemberRef>>): RowData {
  const defaults = defaultFieldChoices(members, primary);
  const data: RowData = {};
  for (const key of FIELD_KEYS) {
    const ref = choices[key] ?? defaults[key];
    if (!ref) continue;
    const v = valueOf(members, ref, key);
    if (v !== undefined) data[key] = v;
  }
  return data;
}

/** Hand-edited Result-column values win over the picked column values; an empty override blanks the field. */
export function applyOverrides(data: RowData, overrides: Partial<Record<FieldKey, string>>): RowData {
  const merged: RowData = { ...data };
  for (const [key, raw] of Object.entries(overrides) as [FieldKey, string | undefined][]) {
    const value = (raw ?? "").trim();
    if (value) merged[key] = value;
    else delete merged[key];
  }
  return merged;
}

/**
 * Result data for merging existing employees into one (system-wide duplicates): the primary's
 * values, blanks filled from the others, explicit per-field choices, then typed-over values.
 * Callers validate the result with `validateRow` before writing it.
 */
export function mergeEmployeeData(
  members: MergeMember[],
  primary: MemberRef,
  choices: Partial<Record<FieldKey, MemberRef>>,
  overrides: Partial<Record<FieldKey, string>> = {},
): RowData {
  if (!members.some((m) => sameRef(m.ref, primary))) throw new Error("Primary must be a member of the group");
  return applyOverrides(pickMergedData(members, primary, choices), overrides);
}

/**
 * Decide which row carries the merged data, what action it takes, and which rows fold away.
 * A row primary carries itself (CREATE); an employee primary is carried by the lowest row (UPDATE).
 */
export function buildMergePlan(
  members: MergeMember[],
  primary: MemberRef,
  choices: Partial<Record<FieldKey, MemberRef>>,
): MergePlan {
  const rowMembers = members.filter((m) => m.ref.kind === "row");
  if (rowMembers.length === 0) throw new Error("A merge needs at least one row from the file");

  let carrier: MergeMember;
  if (primary.kind === "row") {
    const found = rowMembers.find((m) => sameRef(m.ref, primary));
    if (!found) throw new Error("Primary row is not part of this group");
    carrier = found;
  } else {
    carrier = [...rowMembers].sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0))[0];
  }

  const data = pickMergedData(members, primary, choices);

  return {
    carrierRowId: carrier.ref.id,
    action: primary.kind === "employee" ? "UPDATE" : "CREATE",
    targetEmployeeId: primary.kind === "employee" ? primary.id : null,
    data,
    mergedAwayRowIds: rowMembers.filter((m) => m.ref.id !== carrier.ref.id).map((m) => m.ref.id),
  };
}
