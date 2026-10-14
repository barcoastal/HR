import "server-only";
import { getEmployees } from "@/lib/actions/employees";
import { displayName } from "@/lib/utils";
import { browsablePeople, findNeighbors, orderedPeople, parseView } from "@/lib/people-list-order";

export type ProfileNeighbor = { id: string; name: string };
export type ProfileNeighbors = {
  prev: ProfileNeighbor | null;
  next: ProfileNeighbor | null;
  position: number;
  total: number;
};

/**
 * Previous / next person around `employeeId` in the People list view described by `from`
 * (the list's query string; empty means the default view). Uses the same records and order
 * the list shows, limited to profiles the viewer may open. Null when the person is not in it.
 */
export async function getProfileNeighbors(
  employeeId: string,
  from: string,
  viewer: { role: string | null | undefined; employeeId: string | null | undefined }
): Promise<ProfileNeighbors | null> {
  const all = await getEmployees({ status: undefined });
  const people = browsablePeople(
    all.map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      preferredName: e.preferredName,
      email: e.email,
      jobTitle: e.jobTitle,
      status: e.status,
      managerId: e.managerId,
      department: e.department ? { name: e.department.name } : null,
      manager: e.manager ? { name: displayName(e.manager) } : null,
      startDate: e.startDate,
    })),
    viewer
  );
  const n = findNeighbors(orderedPeople(people, parseView(from)), employeeId);
  if (!n) return null;
  const pick = (e: (typeof people)[number] | null) => (e ? { id: e.id, name: displayName(e) } : null);
  return { prev: pick(n.prev), next: pick(n.next), position: n.position, total: n.total };
}
