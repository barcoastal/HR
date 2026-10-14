import { describe, expect, it } from "vitest";
import {
  backToListHref,
  browsablePeople,
  findNeighbors,
  orderedPeople,
  parseView,
  profileHref,
  viewQueryString,
} from "@/lib/people-list-order";

type P = Parameters<typeof orderedPeople>[0][number] & { managerId: string | null };

function person(id: string, over: Partial<P> = {}): P {
  return {
    id,
    firstName: id,
    lastName: "Test",
    preferredName: null,
    email: `${id.toLowerCase()}@example.test`,
    jobTitle: "Analyst",
    status: "ACTIVE",
    department: { name: "Ops" },
    manager: null,
    managerId: null,
    startDate: "2025-01-01T00:00:00.000Z",
    ...over,
  };
}

const people: P[] = [
  person("Cara", { jobTitle: "Engineer", department: { name: "Tech" }, startDate: "2024-03-01" }),
  person("Abe", { jobTitle: "Analyst", startDate: "2025-06-01" }),
  person("Dan", { jobTitle: "", department: null, startDate: "2023-01-01" }),
  person("Bea", { jobTitle: "Engineer", department: { name: "Tech" }, status: "TRAINING", startDate: "2022-01-01" }),
  person("Eve", { jobTitle: "Analyst", preferredName: "Zoe", startDate: "2021-01-01" }),
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("orderedPeople", () => {
  it("defaults to job-title groups (empty last), names sorted inside each group", () => {
    expect(ids(orderedPeople(people, parseView("")))).toEqual(["Abe", "Eve", "Bea", "Cara", "Dan"]);
  });

  it("follows group order, not the flat sort, when grouped", () => {
    expect(ids(orderedPeople(people, parseView("sort=startDate")))).toEqual(["Eve", "Abe", "Bea", "Cara", "Dan"]);
  });

  it("uses the flat sort when grouping is off", () => {
    expect(ids(orderedPeople(people, parseView("group=none&sort=startDate")))).toEqual([
      "Eve", "Bea", "Dan", "Cara", "Abe",
    ]);
  });

  it("groups by status in pipeline order", () => {
    expect(ids(orderedPeople(people, parseView("group=status"))).slice(0, 1)).toEqual(["Bea"]);
  });

  it("applies department, status and search filters", () => {
    expect(ids(orderedPeople(people, parseView("dept=Tech")))).toEqual(["Bea", "Cara"]);
    expect(ids(orderedPeople(people, parseView("status=TRAINING")))).toEqual(["Bea"]);
    // Search matches the preferred name the list displays.
    expect(ids(orderedPeople(people, parseView("q=zoe")))).toEqual(["Eve"]);
  });

  it("falls back to defaults for unknown view values", () => {
    expect(parseView("group=bogus&sort=nope")).toMatchObject({ groupBy: "jobTitle", sortBy: "name" });
  });
});

describe("findNeighbors", () => {
  const ordered = orderedPeople(people, parseView(""));

  it("returns previous, next and position", () => {
    const n = findNeighbors(ordered, "Bea")!;
    expect(n.prev?.id).toBe("Eve");
    expect(n.next?.id).toBe("Cara");
    expect([n.position, n.total]).toEqual([3, 5]);
  });

  it("has no previous at the start and no next at the end", () => {
    expect(findNeighbors(ordered, "Abe")!.prev).toBeNull();
    expect(findNeighbors(ordered, "Dan")!.next).toBeNull();
  });

  it("returns null for someone not in the view", () => {
    expect(findNeighbors(orderedPeople(people, parseView("dept=Tech")), "Abe")).toBeNull();
  });
});

describe("browsablePeople", () => {
  const staff = [
    person("Mgr"),
    person("Report", { managerId: "Mgr" }),
    person("Other"),
    person("New", { status: "PENDING" }),
  ];

  it("gives admins everyone the list shows (no pending)", () => {
    expect(ids(browsablePeople(staff, { role: "HR", employeeId: "x" }))).toEqual(["Mgr", "Report", "Other"]);
  });

  it("limits managers to themselves and their direct reports", () => {
    expect(ids(browsablePeople(staff, { role: "MANAGER", employeeId: "Mgr" }))).toEqual(["Mgr", "Report"]);
  });

  it("gives employees nothing", () => {
    expect(browsablePeople(staff, { role: "EMPLOYEE", employeeId: "Report" })).toEqual([]);
  });
});

describe("links", () => {
  it("keeps only list-view params", () => {
    expect(viewQueryString("group=status&tab=pending&focus=a&q=x")).toBe("group=status&q=x");
  });

  it("carries the view in from= and back to the list with focus", () => {
    expect(profileHref("p1", "")).toBe("/people/p1");
    expect(profileHref("p1", "dept=Tech&q=a b")).toBe("/people/p1?from=dept%3DTech%26q%3Da%20b");
    expect(backToListHref("dept=Tech&evil=1", "p1")).toBe("/people?dept=Tech&focus=p1");
    expect(backToListHref("", "p1")).toBe("/people?focus=p1");
  });
});
