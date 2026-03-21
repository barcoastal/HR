"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { approveAndInviteEmployee, bulkApproveAndInviteEmployees } from "@/lib/actions/employees";
import { Icon } from "@/components/ui/icon";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  status: string;
  pronouns: string | null;
  profilePhoto: string | null;
  department: { name: string } | null;
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-500",
  ACTIVE: "bg-emerald-500",
  ONBOARDING: "bg-blue-500",
  OFFBOARDED: "bg-gray-400",
};

const departmentColors: Record<string, string> = {
  Engineering: "bg-blue-500/15 text-blue-400",
  Design: "bg-pink-500/15 text-pink-400",
  Marketing: "bg-purple-500/15 text-purple-400",
  "Human Resources": "bg-indigo-500/15 text-indigo-400",
  Product: "bg-cyan-500/15 text-cyan-400",
  Finance: "bg-teal-500/15 text-teal-400",
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-teal-500"];

export function PeopleList({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: string[];
}) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const router = useRouter();

  const pendingEmployees = employees.filter((e) => e.status === "PENDING");
  const nonPendingEmployees = employees.filter((e) => e.status !== "PENDING");

  const filtered = nonPendingEmployees.filter((emp) => {
    const matchesSearch =
      !search ||
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      emp.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept =
      selectedDept === "All" || emp.department?.name === selectedDept;
    return matchesSearch && matchesDept;
  });

  async function handleApprove(id: string) {
    setApprovingId(id);
    await approveAndInviteEmployee(id);
    setApprovingId(null);
    router.refresh();
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    await bulkApproveAndInviteEmployees(pendingEmployees.map((e) => e.id));
    setApprovingAll(false);
    router.refresh();
  }

  return (
    <>
      {pendingEmployees.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {pendingEmployees.length} Pending Employee{pendingEmployees.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Approve to send login invitations
              </p>
            </div>
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                "bg-emerald-500 text-white hover:bg-emerald-600",
                "disabled:opacity-50 transition-colors"
              )}
            >
              {approvingAll ? (
                <><Icon name="progress_activity" size={12} className="animate-material-spin" /> Approving...</>
              ) : (
                <><Icon name="how_to_reg" size={12} /> Approve All & Send Invites</>
              )}
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pendingEmployees.map((emp) => {
              const initials = getInitials(emp.firstName, emp.lastName);
              const colorIdx = emp.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", avatarColors[colorIdx])}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {emp.jobTitle} {emp.department ? `· ${emp.department.name}` : ""} · {emp.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleApprove(emp.id)}
                    disabled={approvingId === emp.id}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0",
                      "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search by name, title, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full pl-10 pr-4 py-2.5 rounded-xl text-sm",
            "bg-[var(--color-surface)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
            "transition-all"
          )}
        />
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Icon name="filter_list" size={16} className="text-[var(--color-text-muted)] shrink-0" />
        {["All", ...departments].map((dept) => (
          <button
            key={dept}
            onClick={() => setSelectedDept(dept)}
            className={cn(
              "px-3 py-3 h-11 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
              selectedDept === dept
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {dept}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((employee) => {
          const initials = getInitials(employee.firstName, employee.lastName);
          const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;
          const deptName = employee.department?.name || "";
          return (
            <Link
              key={employee.id}
              href={`/people/${employee.id}`}
              className={cn(
                "rounded-2xl p-5",
                "bg-[var(--color-surface)] border border-[var(--color-border)]",
                "hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)]/30",
                "transition-all group"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  {employee.profilePhoto ? (
                    <img src={employee.profilePhoto} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold", avatarColors[colorIdx])}>
                      {initials}
                    </div>
                  )}
                  <div className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)]", statusColors[employee.status] || "bg-gray-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                    {employee.firstName} {employee.lastName}
                    {employee.pronouns && <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">({employee.pronouns})</span>}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">{employee.jobTitle}</p>
                  {deptName && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", departmentColors[deptName] || "bg-gray-500/15 text-gray-400")}>
                        {deptName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
                    <Icon name="mail" size={12} />
                    <span className="truncate">{employee.email}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[var(--color-text-muted)] py-12">
          No employees found matching your criteria.
        </p>
      )}
    </>
  );
}
