export type RehireStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNDECIDED";
export type RehireFilter = "ALL" | RehireStatus;

export const REHIRE_LABELS: Record<RehireStatus, string> = {
  ELIGIBLE: "Eligible for rehire",
  NOT_ELIGIBLE: "Not eligible for rehire",
  UNDECIDED: "Rehire not decided",
};

/** Nobody has answered yet is its own state: it must never read as a "no". */
export function rehireStatus(eligible: boolean | null): RehireStatus {
  if (eligible === null) return "UNDECIDED";
  return eligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
}

/** Form value ("yes" | "no" | "") to the stored decision. */
export function parseRehireChoice(choice: string): boolean | null {
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return null;
}

export function filterByRehireStatus<T extends { rehireEligible: boolean | null }>(people: T[], filter: RehireFilter): T[] {
  if (filter === "ALL") return people;
  return people.filter((person) => rehireStatus(person.rehireEligible) === filter);
}
