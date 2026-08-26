import { nameKeys } from "./normalize";

export type ManagerCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
};

export type ManagerMatch = { id: string } | { error: "none" | "ambiguous" };

/** Unordered name keys a free-text "First Last" / "Last First" / "Last, First" reference could stand for. */
function referenceKeys(reference: string): string[] {
  const tokens = reference.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return [];
  const keys = new Set<string>();
  // nameKeys sorts the two halves, so token order never matters; what does matter is where the
  // split falls when the name has more than two words ("Mary Ann Smith" vs "Mary Ann-Smith").
  for (const k of nameKeys(tokens[0], tokens.slice(1).join(" "))) keys.add(k);
  for (const k of nameKeys(tokens.slice(0, -1).join(" "), tokens[tokens.length - 1])) keys.add(k);
  return Array.from(keys);
}

/**
 * Resolve a manager reference from an import row. References containing "@" are matched on exact
 * (case-insensitive) email; anything else is matched by name using the same normalization as
 * duplicate detection (first+last or preferred+last). Exactly one person must match.
 */
export function matchManager(reference: string, people: ManagerCandidate[]): ManagerMatch {
  const ref = reference.trim();
  if (!ref) return { error: "none" };

  const hits = new Set<string>();
  if (ref.includes("@")) {
    const email = ref.toLowerCase();
    for (const p of people) if (p.email.trim().toLowerCase() === email) hits.add(p.id);
  } else {
    const wanted = new Set(referenceKeys(ref));
    if (wanted.size === 0) return { error: "none" };
    for (const p of people) {
      if (nameKeys(p.firstName, p.lastName, p.preferredName).some((k) => wanted.has(k))) hits.add(p.id);
    }
  }

  if (hits.size === 1) return { id: hits.values().next().value! };
  return { error: hits.size === 0 ? "none" : "ambiguous" };
}
