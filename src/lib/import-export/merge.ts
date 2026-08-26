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

  const defaults = defaultFieldChoices(members, primary);
  const data: RowData = {};
  for (const key of FIELD_KEYS) {
    const ref = choices[key] ?? defaults[key];
    if (!ref) continue;
    const v = valueOf(members, ref, key);
    if (v !== undefined) data[key] = v;
  }

  return {
    carrierRowId: carrier.ref.id,
    action: primary.kind === "employee" ? "UPDATE" : "CREATE",
    targetEmployeeId: primary.kind === "employee" ? primary.id : null,
    data,
    mergedAwayRowIds: rowMembers.filter((m) => m.ref.id !== carrier.ref.id).map((m) => m.ref.id),
  };
}
