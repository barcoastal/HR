"use client";

import { cn, getInitials, displayFirstName, displayName, formatDate } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  approveAndInviteEmployee,
  bulkApproveAndInviteEmployees,
} from "@/lib/actions/employees";
import { Icon } from "@/components/ui/icon";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  jobTitle: string;
  status: string;
  pronouns: string | null;
  profilePhoto: string | null;
  department: { name: string } | null;
  manager: { id: string; name: string } | null;
  startDate: string;
};

export type OutOfOfficeInfo = { type: string; note: string | null; endDate: Date | string };

function OutOfOfficeBadge({ info }: { info: OutOfOfficeInfo }) {
  const remote = info.type === "WORKING_REMOTELY";
  const back = new Date(info.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <span
      title={info.note || undefined}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
        remote ? "bg-cyan-500/15 text-cyan-700" : "bg-amber-500/15 text-amber-700"
      )}
    >
      <Icon name={remote ? "home_work" : "beach_access"} size={12} />
      {remote ? `Remote until ${back}` : `Out until ${back}`}
    </span>
  );
}

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

function StatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: string; className: string }> = {
    ACTIVE: { label: "Available", icon: "circle", className: "text-green-600 bg-green-50" },
    PRE_ONBOARDING: { label: "Written Offer", icon: "assignment", className: "text-purple-600 bg-purple-50" },
    TRAINING: { label: "Training", icon: "school", className: "text-indigo-600 bg-indigo-50" },
    ONBOARDING: { label: "Onboarding", icon: "rocket_launch", className: "text-[var(--color-primary)] bg-[var(--color-primary-fixed)]/30" },
    PENDING: { label: "Pending Approval", icon: "schedule", className: "text-amber-600 bg-amber-50" },
    OFFBOARDED: { label: "Offboarded", icon: "block", className: "text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)]" },
  };
  const c = config[status] || config.ACTIVE;
  return (
    <div className={cn("flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider px-2 py-1 rounded-md", c.className)}>
      <Icon name={c.icon} size={14} /> {c.label}
    </div>
  );
}

type GroupBy = "jobTitle" | "department" | "manager" | "status" | "none";
type SortBy = "name" | "startDate" | "jobTitle";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "jobTitle", label: "Job title" },
  { value: "department", label: "Department" },
  { value: "manager", label: "Manager" },
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "startDate", label: "Start date" },
  { value: "jobTitle", label: "Job title" },
];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  PRE_ONBOARDING: "Written Offer",
  TRAINING: "Training",
  ONBOARDING: "Onboarding",
  OFFBOARDED: "Offboarded",
};
const STATUS_ORDER = ["PENDING", "PRE_ONBOARDING", "TRAINING", "ONBOARDING", "ACTIVE", "OFFBOARDED"];

/** Group label used when a person has no value for the grouping field; sorted last. */
const EMPTY_GROUP: Record<GroupBy, string> = {
  jobTitle: "No job title",
  department: "No department",
  manager: "No manager",
  status: "",
  none: "",
};

const SEARCH_DEBOUNCE_MS = 250;

function groupKeyFor(emp: Employee, groupBy: GroupBy): string {
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

function parseGroupBy(value: string | null): GroupBy {
  return GROUP_OPTIONS.some((o) => o.value === value) ? (value as GroupBy) : "jobTitle";
}

function parseSortBy(value: string | null): SortBy {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as SortBy) : "name";
}

function compareGroupNames(a: string, b: string, groupBy: GroupBy): number {
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

const selectClass =
  "px-2.5 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30";

function ToolbarSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
      <span className="hidden sm:inline">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={selectClass}>
        {children}
      </select>
    </label>
  );
}

export function PeopleList({
  employees,
  departments,
  outOfOffice = {},
}: {
  employees: Employee[];
  departments: { name: string; memberCount: number }[];
  /** employeeId -> current OOO entry, already audience-filtered for this viewer. */
  outOfOffice?: Record<string, OutOfOfficeInfo>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // View state lives in the URL so a view is shareable and survives refresh.
  const groupBy = parseGroupBy(searchParams.get("group"));
  const sortBy = parseSortBy(searchParams.get("sort"));
  const deptFilter = searchParams.get("dept") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const urlQuery = searchParams.get("q") ?? "";

  // The search box keeps a local draft so typing stays responsive; the URL catches up after a
  // short debounce. Once the URL matches the draft we drop it and read from the URL again, so
  // browser back/forward keeps the box in sync.
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  if (draftQuery !== null && draftQuery === urlQuery) {
    setDraftQuery(null);
  }
  const query = draftQuery ?? urlQuery;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const pendingEmployees = employees.filter((e) => e.status === "PENDING");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "") params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleSearchChange(value: string) {
    setDraftQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setParam("q", value), SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setDraftQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("dept");
    params.delete("status");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApprove(id: string) {
    setApprovingId(id);
    await approveAndInviteEmployee(id);
    setApprovingId(null);
    router.refresh();
  }

  async function handleApproveAll() {
    if (pendingEmployees.length === 0) return;
    if (!confirm(`Approve all ${pendingEmployees.length} pending people and send them login invitations?`)) return;
    setApprovingAll(true);
    await bulkApproveAndInviteEmployees(pendingEmployees.map((e) => e.id));
    setApprovingAll(false);
    router.refresh();
  }

  // Filter → sort → group.
  const needle = query.trim().toLowerCase();
  const filtered = employees.filter((emp) => {
    if (deptFilter && emp.department?.name !== deptFilter) return false;
    if (statusFilter && emp.status !== statusFilter) return false;
    if (needle) {
      const matches = [displayName(emp), emp.email, emp.jobTitle].some((field) =>
        field.toLowerCase().includes(needle)
      );
      if (!matches) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "startDate") {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    if (sortBy === "jobTitle") {
      return a.jobTitle.localeCompare(b.jobTitle) || displayName(a).localeCompare(displayName(b));
    }
    return displayName(a).localeCompare(displayName(b));
  });

  const groups = new Map<string, Employee[]>();
  for (const emp of sorted) {
    const key = groupKeyFor(emp, groupBy);
    const members = groups.get(key);
    if (members) members.push(emp);
    else groups.set(key, [emp]);
  }
  const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => compareGroupNames(a, b, groupBy));

  const hasActiveFilters = Boolean(needle || deptFilter || statusFilter);

  function renderRow(emp: Employee) {
    const initials = getInitials(displayFirstName(emp), emp.lastName);
    const colorIdx = displayFirstName(emp).charCodeAt(0) % avatarColors.length;
    const preferred = emp.preferredName?.trim();
    const subline = [preferred ? `Goes by ${preferred}` : null, emp.pronouns].filter(Boolean).join(" · ");
    const ooo = outOfOffice[emp.id];
    const isPending = emp.status === "PENDING";

    return (
      <tr
        key={emp.id}
        onClick={() => router.push(`/people/${emp.id}`)}
        className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {emp.profilePhoto ? (
              <img src={emp.profilePhoto} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center text-white text-[11px] font-semibold shrink-0",
                  avatarColors[colorIdx]
                )}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <Link
                href={`/people/${emp.id}`}
                onClick={(e) => e.stopPropagation()}
                className="block font-medium text-[var(--color-text-primary)] truncate hover:underline"
              >
                {displayName(emp)}
              </Link>
              {subline && <p className="text-xs text-[var(--color-text-muted)] truncate">{subline}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-[var(--color-text-primary)]">
          {emp.jobTitle || <span className="text-[var(--color-text-muted)]">—</span>}
        </td>
        <td className="px-4 py-2.5 text-[var(--color-on-surface-variant)]">
          {emp.department?.name || <span className="text-[var(--color-text-muted)]">—</span>}
        </td>
        <td className="px-4 py-2.5 text-[var(--color-on-surface-variant)]">
          {emp.manager?.name || <span className="text-[var(--color-text-muted)]">—</span>}
        </td>
        <td className="px-4 py-2.5">
          <a
            href={`mailto:${emp.email}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] hover:underline"
          >
            {emp.email}
          </a>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap text-[var(--color-on-surface-variant)]">
          {formatDate(emp.startDate)}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel status={emp.status} />
            {ooo && <OutOfOfficeBadge info={ooo} />}
            {isPending && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApprove(emp.id);
                }}
                disabled={approvingId === emp.id || approvingAll}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap",
                  "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
                  "disabled:opacity-50 transition-colors"
                )}
              >
                {approvingId === emp.id ? (
                  <Icon name="progress_activity" size={12} className="animate-material-spin" />
                ) : (
                  <Icon name="how_to_reg" size={12} />
                )}
                Approve
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or job title"
            aria-label="Search people"
            className={cn(
              "w-full pl-10 pr-3 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            )}
          />
        </div>

        <ToolbarSelect label="Group by" value={groupBy} onChange={(v) => setParam("group", v === "jobTitle" ? null : v)}>
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect label="Department" value={deptFilter} onChange={(v) => setParam("dept", v)}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect label="Status" value={statusFilter} onChange={(v) => setParam("status", v)}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect label="Sort" value={sortBy} onChange={(v) => setParam("sort", v === "name" ? null : v)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </ToolbarSelect>

        <div className="ml-auto text-sm text-[var(--color-on-surface-variant)] font-medium whitespace-nowrap">
          {sorted.length} {sorted.length === 1 ? "person" : "people"}
        </div>
      </div>

      {/* Grouped list */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No people match these filters.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orderedGroups.map(([name, members]) => {
            const collapseKey = `${groupBy}:${name}`;
            const isCollapsed = groupBy !== "none" && collapsed.has(collapseKey);
            return (
              <section
                key={name || "all"}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                {groupBy !== "none" && (
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(collapseKey)}
                    aria-expanded={!isCollapsed}
                    className={cn(
                      "sticky top-16 z-10 flex w-full items-center gap-3 px-4 py-3 rounded-t-2xl text-left",
                      "bg-[var(--color-surface-container-low)] border-[var(--color-border)]",
                      isCollapsed ? "rounded-b-2xl" : "border-b"
                    )}
                  >
                    <Icon
                      name={isCollapsed ? "chevron_right" : "expand_more"}
                      size={18}
                      className="text-[var(--color-text-muted)]"
                    />
                    <span className="font-semibold text-[var(--color-text-primary)]">{name}</span>
                    <span className="rounded-full bg-[var(--color-surface-container)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                      {members.length}
                    </span>
                  </button>
                )}
                {!isCollapsed && (
                  <div className={cn("overflow-x-auto", groupBy === "none" ? "rounded-2xl" : "rounded-b-2xl")}>
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Person</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Job title</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Department</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Manager</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Email</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Start date</th>
                          <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>{members.map(renderRow)}</tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
