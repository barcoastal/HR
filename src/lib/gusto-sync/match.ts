import { EMPLOYEE_FIELDS } from "@/lib/import-export/employee-fields";
import { nameKeys } from "@/lib/import-export/normalize";
import type { FieldDef, RowData } from "@/lib/import-export/types";
import type { GustoFieldChange, GustoMatchedBy, GustoPerson, GustoSyncStrategy } from "./types";

// ---------------------------------------------------------------------------
// Matching — pure, so it can be unit-tested without Gusto or the database.
// ---------------------------------------------------------------------------

/** The system-side person flattened with employeeToRowData, plus the payroll link. */
export type SyncCandidate = { id: string; gustoEmployeeId: string | null; data: RowData };

export type GustoMatchResult = { person: GustoPerson; matchedBy: GustoMatchedBy };

export type GustoIndex = {
  byId: Map<string, GustoPerson>;
  byEmail: Map<string, GustoPerson[]>;
  byName: Map<string, GustoPerson[]>;
  /** Gusto ids already linked to someone — never offered to anyone else by email or name. */
  claimed: Set<string>;
};

/** Lowercased and trimmed; "" for blanks and for the pending.local placeholder unapproved people carry. */
export function emailKey(raw: string | null | undefined): string {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || email.endsWith("@pending.local")) return "";
  return email;
}

export function gustoDisplayName(data: RowData): string {
  return `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
}

function push(map: Map<string, GustoPerson[]>, key: string, person: GustoPerson) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(person);
  else map.set(key, [person]);
}

export function buildGustoIndex(people: GustoPerson[], claimed: Iterable<string> = []): GustoIndex {
  const index: GustoIndex = { byId: new Map(), byEmail: new Map(), byName: new Map(), claimed: new Set(claimed) };
  for (const person of people) {
    index.byId.set(person.gustoId, person);
    push(index.byEmail, emailKey(person.data.email), person);
    push(index.byEmail, emailKey(person.data.personalEmail), person);
    for (const key of nameKeys(person.data.firstName, person.data.lastName, person.data.preferredName)) {
      push(index.byName, key, person);
    }
  }
  return index;
}

/**
 * Find the Gusto record for one person: the stored gustoEmployeeId wins; otherwise an exact
 * (case-insensitive) email match against Gusto's work or personal email — the person's own email
 * first, then their personal one; otherwise a name that matches exactly one Gusto employee.
 * A Gusto record that is already linked to someone else is never offered.
 */
export function matchGustoPerson(candidate: SyncCandidate, index: GustoIndex): GustoMatchResult | null {
  if (candidate.gustoEmployeeId) {
    const person = index.byId.get(candidate.gustoEmployeeId);
    return person ? { person, matchedBy: "gustoId" } : null;
  }

  const free = (list: GustoPerson[] | undefined): GustoPerson[] => {
    const unique = new Map<string, GustoPerson>();
    for (const g of list ?? []) if (!index.claimed.has(g.gustoId)) unique.set(g.gustoId, g);
    return Array.from(unique.values());
  };

  const emails: [string, GustoMatchedBy][] = [
    [emailKey(candidate.data.email), "email"],
    [emailKey(candidate.data.personalEmail), "personalEmail"],
  ];
  for (const [key, matchedBy] of emails) {
    if (!key) continue;
    const hits = free(index.byEmail.get(key));
    if (hits.length === 1) return { person: hits[0], matchedBy };
  }

  const byName = new Map<string, GustoPerson>();
  for (const key of nameKeys(candidate.data.firstName, candidate.data.lastName, candidate.data.preferredName)) {
    for (const g of free(index.byName.get(key))) byName.set(g.gustoId, g);
  }
  if (byName.size === 1) return { person: Array.from(byName.values())[0], matchedBy: "name" };
  return null;
}

// ---------------------------------------------------------------------------
// Diff — the same rules as the import preview ("What will change").
// ---------------------------------------------------------------------------

/**
 * Values the commit would treat as the same: departments/teams/managers resolve by
 * case-insensitive name, emails are lowercased, phones are compared by digits only.
 */
function comparable(field: FieldDef, value: string): string {
  const v = value.trim();
  switch (field.type) {
    case "relation":
    case "email":
      return v.toLowerCase();
    case "phone":
      return v.replace(/\D/g, "");
    default:
      return v;
  }
}

/** Fields where Gusto has a non-empty value that differs from the system. Status is never included. */
export function diffGustoData(current: RowData, incoming: RowData): GustoFieldChange[] {
  const changes: GustoFieldChange[] = [];
  for (const field of EMPLOYEE_FIELDS) {
    if (field.key === "status") continue;
    const to = (incoming[field.key] ?? "").trim();
    if (!to) continue;
    const from = (current[field.key] ?? "").trim();
    if (from && comparable(field, from) === comparable(field, to)) continue;
    changes.push({ key: field.key, label: field.label, current: from, incoming: to });
  }
  return changes;
}

/** The subset of changes a strategy actually writes, as row data for employeeUpdateFromRowData. */
export function selectGustoChanges(changes: GustoFieldChange[], strategy: GustoSyncStrategy): RowData {
  const data: RowData = {};
  for (const change of changes) {
    if (strategy === "fill" && change.current) continue;
    data[change.key] = change.incoming;
  }
  return data;
}
