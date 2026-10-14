// Pure filter → sort → group logic for the People list. Shared by the list itself (client) and
// the profile page's Previous / Next navigation (server), so both always agree on the order.
import { displayName } from "@/lib/utils";

export type GroupBy = "jobTitle" | "department" | "manager" | "status" | "none";
export type SortBy = "name" | "startDate" | "jobTitle";

/** The fields the list needs to filter, sort and group a person. */
export type PeopleListPerson = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  jobTitle: string;
  status: string;
  department: { name: string } | null;
  manager: { name: string } | null;
  startDate: string | Date;
};

export type PeopleListView = {
  groupBy: GroupBy;
  sortBy: SortBy;
  dept: string;
  status: string;
  q: string;
};

export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "jobTitle", label: "Job title" },
  { value: "department", label: "Department" },
  { value: "manager", label: "Manager" },
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];
export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "startDate", label: "Start date" },
  { value: "jobTitle", label: "Job title" },
];
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  PRE_ONBOARDING: "Written Offer",
  TRAINING: "Training",
  ONBOARDING: "Onboarding",
  OFFBOARDED: "Offboarded",
};
export const STATUS_ORDER = ["PENDING", "PRE_ONBOARDING", "TRAINING", "ONBOARDING", "ACTIVE", "OFFBOARDED"];

/** Group label used when a person has no value for the grouping field; sorted last. */
const EMPTY_GROUP: Record<GroupBy, string> = {
  jobTitle: "No job title",
  department: "No department",
  manager: "No manager",
  status: "",
  none: "",
};

/** URL params that describe a list view. Anything else is dropped when carrying the view around. */
export const VIEW_PARAM_KEYS = ["group", "sort", "dept", "status", "q"] as const;

export function parseGroupBy(value: string | null | undefined): GroupBy {
  return GROUP_OPTIONS.some((o) => o.value === value) ? (value as GroupBy) : "jobTitle";
}

export function parseSortBy(value: string | null | undefined): SortBy {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as SortBy) : "name";
}

/** Reads a list view from URL params (missing or unknown values fall back to the defaults). */
export function parseView(params: URLSearchParams | string | null | undefined): PeopleListView {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params ?? "");
  return {
    groupBy: parseGroupBy(p.get("group")),
    sortBy: parseSortBy(p.get("sort")),
    dept: p.get("dept") ?? "",
    status: p.get("status") ?? "",
    q: p.get("q") ?? "",
  };
}

/** Keeps only the list-view params of a query string, e.g. to carry it in `?from=`. */
export function viewQueryString(params: URLSearchParams | string | null | undefined): string {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params ?? "");
  const out = new URLSearchParams();
  for (const key of VIEW_PARAM_KEYS) {
    const value = p.get(key);
    if (value) out.set(key, value);
  }
  return out.toString();
}

export function groupKeyFor(emp: PeopleListPerson, groupBy: GroupBy): string {
  switch (groupBy) {
    case "jobTitle":
      return emp.jobTitle || EMPTY_GROUP.jobTitle;
    case "department":
      return emp.department?.name || EMPTY_GROUP.department;
    case "manager":
      return emp.manager?.name || EMPTY_GROUP.manager;
    case "status":
      return STATUS_LABELS[emp.status] || emp.status;
    default:
      return "";
  }
}

export function compareGroupNames(a: string, b: string, groupBy: GroupBy): number {
  if (groupBy === "status") {
    const index = (label: string) => {
      const i = STATUS_ORDER.findIndex((s) => STATUS_LABELS[s] === label);
      return i === -1 ? STATUS_ORDER.length : i;
    };
    return index(a) - index(b) || a.localeCompare(b);
  }
  const empty = EMPTY_GROUP[groupBy];
  if (a === empty) return 1;
  if (b === empty) return -1;
  return a.localeCompare(b);
}

/** Filters, sorts and groups people exactly as the People list shows them. */
export function arrangePeople<T extends PeopleListPerson>(
  employees: T[],
  view: PeopleListView
): { count: number; groups: [string, T[]][] } {
  const needle = view.q.trim().toLowerCase();
  const filtered = employees.filter((emp) => {
    if (view.dept && emp.department?.name !== view.dept) return false;
    if (view.status && emp.status !== view.status) return false;
    if (needle) {
      const matches = [displayName(emp), emp.email, emp.jobTitle].some((field) =>
        (field ?? "").toLowerCase().includes(needle)
      );
      if (!matches) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (view.sortBy === "startDate") {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    if (view.sortBy === "jobTitle") {
      return a.jobTitle.localeCompare(b.jobTitle) || displayName(a).localeCompare(displayName(b));
    }
    return displayName(a).localeCompare(displayName(b));
  });

  const groups = new Map<string, T[]>();
  for (const emp of sorted) {
    const key = groupKeyFor(emp, view.groupBy);
    const members = groups.get(key);
    if (members) members.push(emp);
    else groups.set(key, [emp]);
  }
  const ordered = Array.from(groups.entries()).sort(([a], [b]) => compareGroupNames(a, b, view.groupBy));
  return { count: sorted.length, groups: ordered };
}

/** The people in the exact top-to-bottom order the list renders them (group by group). */
export function orderedPeople<T extends PeopleListPerson>(employees: T[], view: PeopleListView): T[] {
  return arrangePeople(employees, view).groups.flatMap(([, members]) => members);
}

export type Neighbors<T> = { prev: T | null; next: T | null; position: number; total: number };

/** Previous / next person around `id` in an ordered list; null when `id` is not in it. */
export function findNeighbors<T extends { id: string }>(ordered: T[], id: string): Neighbors<T> | null {
  const index = ordered.findIndex((e) => e.id === id);
  if (index === -1) return null;
  return {
    prev: index > 0 ? ordered[index - 1] : null,
    next: index < ordered.length - 1 ? ordered[index + 1] : null,
    position: index + 1,
    total: ordered.length,
  };
}

const LIST_ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "HR"]);

/**
 * The people a viewer may step through with Previous / Next: those the People list shows them
 * (everyone except PENDING, which lives on its own tab) narrowed to profiles they may open.
 * Admin/HR may open everyone; managers only themselves and their direct reports (the same rule
 * the profile page enforces); everyone else cannot browse the list at all.
 */
export function browsablePeople<T extends { id: string; status: string; managerId: string | null }>(
  employees: T[],
  viewer: { role: string | null | undefined; employeeId: string | null | undefined }
): T[] {
  const listed = employees.filter((e) => e.status !== "PENDING");
  if (viewer.role && LIST_ADMIN_ROLES.has(viewer.role)) return listed;
  if (viewer.role === "MANAGER" && viewer.employeeId) {
    return listed.filter((e) => e.id === viewer.employeeId || e.managerId === viewer.employeeId);
  }
  return [];
}

/** Profile URL that remembers which list view it was opened from. */
export function profileHref(id: string, from: string): string {
  return from ? `/people/${id}?from=${encodeURIComponent(from)}` : `/people/${id}`;
}

/** List URL that restores the view and scrolls back to `focusId`. */
export function backToListHref(from: string, focusId: string): string {
  const params = new URLSearchParams(viewQueryString(from));
  params.set("focus", focusId);
  return `/people?${params.toString()}`;
}
