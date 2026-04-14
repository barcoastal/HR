"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { approveAndInviteEmployee, bulkApproveAndInviteEmployees } from "@/lib/actions/employees";
import { Icon } from "@/components/ui/icon";
import { FAB } from "@/components/ui/fab";

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
    PRE_ONBOARDING: { label: "Pre-Onboarding", icon: "assignment", className: "text-purple-600 bg-purple-50" },
    ONBOARDING: { label: "Onboarding", icon: "rocket_launch", className: "text-[var(--color-primary)] bg-[var(--color-primary-fixed)]/30" },
    PENDING: { label: "Pending Approval", icon: "schedule", className: "text-amber-600 bg-amber-50" },
    OFFBOARDED: { label: "Offboarded", icon: "block", className: "text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)]" },
  };
  const c = config[status] || config.ACTIVE;
  return (
    <div className={cn("flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider py-2 rounded-lg w-full", c.className)}>
      <Icon name={c.icon} size={14} /> {c.label}
    </div>
  );
}

const PAGE_SIZE = 12;

export function PeopleList({
  employees,
  departments,
}: {
  employees: Employee[];
  departments: { name: string; memberCount: number }[];
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDept, setSelectedDept] = useState("All");
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const router = useRouter();

  const pendingEmployees = employees.filter((e) => e.status === "PENDING");
  const nonPendingEmployees = employees.filter((e) => e.status !== "PENDING");

  const filtered = nonPendingEmployees.filter((emp) => {
    return selectedDept === "All" || emp.department?.name === selectedDept;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  function handleDeptChange(dept: string) {
    setSelectedDept(dept);
    setCurrentPage(1);
    setShowDeptDropdown(false);
  }

  const featuredEmployee = paginated[0] ?? null;
  const regularEmployees = paginated.slice(1);

  // Build interleaved: insert a team row after every 4 regular cards
  // We'll track which departments have been shown
  const TEAM_ROW_INTERVAL = 4;

  return (
    <>
      {/* Pending employees section */}
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

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-8 relative">
        <div className="relative">
          <button
            onClick={() => setShowDeptDropdown((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all",
              showDeptDropdown || selectedDept !== "All"
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-on-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-container)]"
            )}
          >
            <Icon name="filter_list" size={16} />
            Filters
            {selectedDept !== "All" && (
              <span className="ml-1 bg-white/20 rounded-md px-1.5 py-0.5 text-xs">{selectedDept}</span>
            )}
            <Icon name="expand_more" size={16} />
          </button>
          {showDeptDropdown && (
            <div className="absolute top-full left-0 mt-2 z-50 min-w-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
              <button
                onClick={() => handleDeptChange("All")}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors",
                  selectedDept === "All"
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                )}
              >
                All Departments
              </button>
              {departments.map((d) => (
                <button
                  key={d.name}
                  onClick={() => handleDeptChange(d.name)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between",
                    selectedDept === d.name
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
                  )}
                >
                  <span>{d.name}</span>
                  <span className="text-xs text-[var(--color-on-surface-variant)]">{d.memberCount}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all",
            "bg-[var(--color-surface)] text-[var(--color-on-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-container)]"
          )}
        >
          <Icon name="schedule" size={16} />
          Recently Joined
        </button>

        <div className="ml-auto text-sm text-[var(--color-on-surface-variant)] font-medium">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
          {selectedDept !== "All" && ` in ${selectedDept}`}
        </div>
      </div>

      {/* Bento grid */}
      {paginated.length === 0 ? (
        <p className="text-center text-[var(--color-on-surface-variant)] py-12">
          No employees found matching your criteria.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Featured card — first employee, 2-col span */}
            {featuredEmployee && (() => {
              const initials = getInitials(featuredEmployee.firstName, featuredEmployee.lastName);
              const colorIdx = featuredEmployee.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <Link
                  href={`/people/${featuredEmployee.id}`}
                  key={featuredEmployee.id}
                  className={cn(
                    "col-span-1 md:col-span-2 group",
                    "rounded-2xl p-6",
                    "bg-[var(--color-surface)] border border-[var(--color-border)]",
                    "hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)]",
                    "transition-all"
                  )}
                >
                  <div className="flex items-start gap-5">
                    <div className="relative shrink-0">
                      {featuredEmployee.profilePhoto ? (
                        <img
                          src={featuredEmployee.profilePhoto}
                          alt=""
                          className="h-24 w-24 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all"
                        />
                      ) : (
                        <div className={cn("h-24 w-24 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", avatarColors[colorIdx])}>
                          {initials}
                        </div>
                      )}
                      {/* Online indicator */}
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-[var(--color-surface)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1">
                        {featuredEmployee.jobTitle}
                      </p>
                      <p className="text-2xl font-bold text-[var(--color-on-surface)] leading-tight mb-1">
                        {featuredEmployee.firstName} {featuredEmployee.lastName}
                        {featuredEmployee.pronouns && (
                          <span className="text-sm font-normal text-[var(--color-on-surface-variant)] ml-2">({featuredEmployee.pronouns})</span>
                        )}
                      </p>
                      {featuredEmployee.department && (
                        <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">{featuredEmployee.department.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => e.preventDefault()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
                        >
                          <Icon name="chat_bubble" size={14} /> Message
                        </button>
                        <a
                          href={`mailto:${featuredEmployee.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface-container)] text-[var(--color-on-surface)] hover:bg-[var(--color-border)] transition-colors"
                        >
                          <Icon name="mail" size={14} /> Mail
                        </a>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })()}

            {/* Regular cards + interspersed team rows */}
            {regularEmployees.map((employee, idx) => {
              const initials = getInitials(employee.firstName, employee.lastName);
              const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;

              // After every TEAM_ROW_INTERVAL regular cards, insert a team row
              const insertTeamRow = (idx + 1) % TEAM_ROW_INTERVAL === 0;
              const teamRowDept = insertTeamRow ? departments[Math.floor((idx + 1) / TEAM_ROW_INTERVAL) - 1] : null;
              const teamRowEmployees = teamRowDept
                ? nonPendingEmployees.filter((e) => e.department?.name === teamRowDept.name).slice(0, 5)
                : [];

              return (
                <>
                  {/* Regular card */}
                  <Link
                    key={employee.id}
                    href={`/people/${employee.id}`}
                    className={cn(
                      "group rounded-2xl p-5 flex flex-col items-center text-center gap-3",
                      "bg-[var(--color-surface)] border border-[var(--color-border)]",
                      "hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)]",
                      "transition-all"
                    )}
                  >
                    <div className="relative">
                      {employee.profilePhoto ? (
                        <img src={employee.profilePhoto} alt="" className="h-20 w-20 rounded-full object-cover" />
                      ) : (
                        <div className={cn("h-20 w-20 rounded-full flex items-center justify-center text-white text-xl font-bold", avatarColors[colorIdx])}>
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <p className="font-bold text-[var(--color-on-surface)] truncate">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-sm text-[var(--color-on-surface-variant)] truncate mb-3">{employee.jobTitle}</p>
                      <StatusLabel status={employee.status} />
                    </div>
                    <div className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--color-border)] text-[var(--color-on-surface-variant)] group-hover:border-[var(--color-primary)]/40 group-hover:text-[var(--color-primary)] transition-colors">
                      View Profile
                    </div>
                  </Link>

                  {/* Team row after every TEAM_ROW_INTERVAL cards */}
                  {insertTeamRow && teamRowDept && teamRowEmployees.length > 0 && (
                    <div
                      key={`team-row-${teamRowDept.name}-${idx}`}
                      className={cn(
                        "col-span-1 md:col-span-2 lg:col-span-3",
                        "rounded-2xl p-5",
                        "bg-[var(--color-surface-container)] border border-[var(--color-border)]",
                        "flex items-center justify-between gap-4"
                      )}
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-0.5">
                          Team
                        </p>
                        <p className="text-lg font-bold text-[var(--color-on-surface)]">{teamRowDept.name}</p>
                        <p className="text-sm text-[var(--color-on-surface-variant)]">{teamRowDept.memberCount} members</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Avatar stack */}
                        <div className="flex -space-x-3">
                          {teamRowEmployees.map((te, ti) => {
                            const tInitials = getInitials(te.firstName, te.lastName);
                            const tColorIdx = te.firstName.charCodeAt(0) % avatarColors.length;
                            return (
                              <div
                                key={te.id}
                                className={cn(
                                  "h-9 w-9 rounded-full border-2 border-[var(--color-surface-container)] flex items-center justify-center text-white text-xs font-bold",
                                  avatarColors[tColorIdx]
                                )}
                                style={{ zIndex: teamRowEmployees.length - ti }}
                              >
                                {te.profilePhoto ? (
                                  <img src={te.profilePhoto} alt="" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                  tInitials
                                )}
                              </div>
                            );
                          })}
                          {teamRowDept.memberCount > 5 && (
                            <div className="h-9 w-9 rounded-full border-2 border-[var(--color-surface-container)] bg-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-on-surface-variant)]">
                              +{teamRowDept.memberCount - 5}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/org?dept=${encodeURIComponent(teamRowDept.name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[var(--color-border)] text-[var(--color-on-surface)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-colors"
                        >
                          <Icon name="group" size={14} /> View Team
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 w-9 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:opacity-30 transition-all"
              >
                <Icon name="chevron_left" size={18} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                    currentPage === page
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  )}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-9 w-9 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:opacity-30 transition-all"
              >
                <Icon name="chevron_right" size={18} />
              </button>

              <span className="ml-2 text-sm text-[var(--color-on-surface-variant)]">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <FAB
        icon="person_add"
        variant="gradient"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
    </>
  );
}
