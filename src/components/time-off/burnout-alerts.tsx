import { cn, getInitials } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function BurnoutAlerts({ employees }: { employees: Employee[] }) {
  if (employees.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--color-text-muted)]">No burnout alerts. Everyone has taken time off recently!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-2 p-3 rounded-lg", "bg-amber-500/10 border border-amber-500/20")}>
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {employees.length} employee{employees.length !== 1 ? "s" : ""} haven&apos;t taken time off in 6+ months
        </p>
      </div>
      {employees.map((emp) => {
        const initials = getInitials(emp.firstName, emp.lastName);
        const colorIdx = emp.firstName.charCodeAt(0) % avatarColors.length;
        return (
          <div key={emp.id} className={cn("flex items-center gap-3 p-3 rounded-lg", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
            <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[colorIdx])}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{emp.firstName} {emp.lastName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{emp.jobTitle}</p>
            </div>
            <span className="text-xs text-amber-500 font-medium">No recent PTO</span>
          </div>
        );
      })}
    </div>
  );
}
