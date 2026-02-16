import { cn, getInitials } from "@/lib/utils";
import { Palmtree } from "lucide-react";

type OutEmployee = {
  employee: { id: string; firstName: string; lastName: string; jobTitle: string };
  policy: { name: string };
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function WhosOutWidget({ outToday }: { outToday: OutEmployee[] }) {
  if (outToday.length === 0) {
    return (
      <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center gap-2 mb-3">
          <Palmtree className="h-5 w-5 text-emerald-500" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Who&apos;s Out Today</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Everyone is in today!</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-3">
        <Palmtree className="h-5 w-5 text-emerald-500" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Who&apos;s Out Today</h3>
        <span className="ml-auto text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-full">
          {outToday.length}
        </span>
      </div>
      <div className="space-y-2">
        {outToday.map((item, i) => {
          const initials = getInitials(item.employee.firstName, item.employee.lastName);
          const colorIdx = item.employee.firstName.charCodeAt(0) % avatarColors.length;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px]", avatarColors[colorIdx])}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{item.employee.firstName} {item.employee.lastName}</p>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)]">{item.policy.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
