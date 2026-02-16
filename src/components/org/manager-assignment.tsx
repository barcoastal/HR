"use client";

import { cn, getInitials } from "@/lib/utils";
import { UsersRound, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeManager } from "@/lib/actions/employees";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmployeeInfo = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
};

type Props = {
  employees: EmployeeInfo[];
};

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const selectClassName = cn(
  "px-3 py-1.5 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ---------------------------------------------------------------------------
// ManagerAssignment
// ---------------------------------------------------------------------------

export function ManagerAssignment({ employees }: Props) {
  const router = useRouter();
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  async function handleManagerChange(
    employeeId: string,
    managerId: string | null
  ) {
    setSavingIds((prev) => ({ ...prev, [employeeId]: true }));
    try {
      await setEmployeeManager(employeeId, managerId);
      router.refresh();
    } finally {
      setSavingIds((prev) => ({ ...prev, [employeeId]: false }));
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            "bg-[var(--color-accent)]/10"
          )}
        >
          <UsersRound className="h-5 w-5 text-[var(--color-accent)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Team Structure
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Assign managers to employees
          </p>
        </div>
      </div>

      {/* Employee list */}
      {employees.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
          No employees found.
        </p>
      ) : (
        <div className="space-y-2">
          {employees.map((employee) => {
            const isSaving = savingIds[employee.id] ?? false;

            return (
              <div
                key={employee.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg",
                  "hover:bg-[var(--color-surface-hover)] transition-colors"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center",
                    "w-8 h-8 rounded-full text-xs font-semibold text-white",
                    getAvatarColor(employee.id)
                  )}
                >
                  {getInitials(employee.firstName, employee.lastName)}
                </div>

                {/* Name & title */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {employee.jobTitle}
                    {employee.departmentName && (
                      <span>
                        {" "}
                        <span className="text-[var(--color-border)]">/</span>{" "}
                        {employee.departmentName}
                      </span>
                    )}
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />

                {/* Manager dropdown */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={employee.managerId ?? ""}
                    onChange={(e) =>
                      handleManagerChange(
                        employee.id,
                        e.target.value || null
                      )
                    }
                    disabled={isSaving}
                    className={cn(selectClassName, "w-52", isSaving && "opacity-50")}
                  >
                    <option value="">No manager</option>
                    {employees
                      .filter((e) => e.id !== employee.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </option>
                      ))}
                  </select>

                  {isSaving && (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)] flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
