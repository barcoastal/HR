export type ReportingPerson = { id: string; managerId: string | null };

/**
 * Why this person cannot report to the chosen manager, or null when the
 * assignment is fine. A loop (the manager already reports up to the person)
 * would leave both of them without a top of the org chart.
 */
export function managerAssignmentError(
  employeeId: string,
  managerId: string,
  people: ReportingPerson[]
): string | null {
  if (managerId === employeeId) return "A person cannot be their own manager.";

  const managerOf = new Map(people.map((person) => [person.id, person.managerId]));
  const seen = new Set<string>();
  let current = managerOf.get(managerId) ?? null;
  while (current && !seen.has(current)) {
    if (current === employeeId) {
      return "This would create a reporting loop: the chosen manager already reports up to this person.";
    }
    seen.add(current);
    current = managerOf.get(current) ?? null;
  }
  return null;
}
