import { cn } from "@/lib/utils";
import {
  UserMinus,
  CheckCircle2,
  ChevronRight,
  Calendar,
  Building2,
  AlertTriangle,
} from "lucide-react";

const stats = [
  {
    label: "Active Offboarding",
    value: "1",
    icon: UserMinus,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    label: "Completed This Month",
    value: "1",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const offboardingEmployees = [
  {
    name: "Marcus Lee",
    initials: "ML",
    avatarColor: "bg-slate-500",
    title: "Frontend Engineer",
    department: "Engineering",
    lastDay: "Feb 28, 2025",
    reason: "Voluntary — New Opportunity",
    progress: 50,
    tasksCompleted: 5,
    totalTasks: 10,
    currentStep: "Knowledge Transfer",
    daysRemaining: 17,
    pendingItems: ["Return laptop", "Revoke VPN access", "Exit interview", "Final paycheck review", "Transfer project ownership"],
  },
];

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
      <div
        className="h-full rounded-full bg-orange-500 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function OffboardingPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Offboarding</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Manage departing employee transitions and task checklists
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "rounded-xl p-5",
                "bg-[var(--color-surface)] border border-[var(--color-border)]"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    stat.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {stat.value}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Offboarding */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Active Offboarding
        </h2>
      </div>
      <div className="space-y-4">
        {offboardingEmployees.map((emp) => (
          <div
            key={emp.name}
            className={cn(
              "rounded-xl overflow-hidden",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Employee Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0",
                      emp.avatarColor
                    )}
                  >
                    {emp.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)]">{emp.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">{emp.title}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {emp.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Last day: {emp.lastDay}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 shrink-0">
                  <AlertTriangle className="h-3 w-3" />
                  {emp.daysRemaining} days remaining
                </div>
              </div>

              {/* Reason */}
              <div className="mt-4 px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Departure reason:{" "}
                  <span className="text-[var(--color-text-primary)] font-medium">{emp.reason}</span>
                </p>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Progress: {emp.progress}%
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {emp.tasksCompleted}/{emp.totalTasks} tasks
                  </span>
                </div>
                <ProgressBar percent={emp.progress} />
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                  Current step: {emp.currentStep}
                </p>
              </div>

              {/* Pending Items */}
              <div className="mt-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Pending Items
                </p>
                <div className="space-y-1.5">
                  {emp.pendingItems.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"
                    >
                      <div className="h-4 w-4 rounded border border-[var(--color-border)] shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recently Completed */}
      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Recently Completed
        </h2>
      </div>
      <div className="space-y-3">
        <div
          className={cn(
            "rounded-xl p-4",
            "bg-[var(--color-surface)] border border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              KW
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Karen White</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Marketing Specialist · Marketing
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Completed</span>
              <span className="text-[var(--color-text-muted)] ml-1">Jan 15, 2025</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
