import { cn } from "@/lib/utils";
import {
  UserPlus,
  CheckCircle2,
  ClipboardList,
  ChevronRight,
  Calendar,
  Building2,
} from "lucide-react";

const stats = [
  {
    label: "Active Onboarding",
    value: "3",
    icon: UserPlus,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    label: "Completed This Month",
    value: "2",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    label: "Pending Tasks",
    value: "7",
    icon: ClipboardList,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

const onboardingEmployees = [
  {
    name: "Emma Wilson",
    initials: "EW",
    avatarColor: "bg-rose-500",
    title: "Product Designer",
    department: "Design",
    startDate: "Feb 3, 2025",
    progress: 30,
    tasksCompleted: 4,
    totalTasks: 14,
    currentStep: "IT Setup & Equipment",
    daysInOnboarding: 8,
  },
  {
    name: "Raj Kapoor",
    initials: "RK",
    avatarColor: "bg-orange-500",
    title: "Backend Engineer",
    department: "Engineering",
    startDate: "Jan 20, 2025",
    progress: 65,
    tasksCompleted: 9,
    totalTasks: 14,
    currentStep: "Team Introductions",
    daysInOnboarding: 22,
  },
  {
    name: "Olivia Brown",
    initials: "OB",
    avatarColor: "bg-violet-500",
    title: "Content Strategist",
    department: "Marketing",
    startDate: "Jan 13, 2025",
    progress: 90,
    tasksCompleted: 13,
    totalTasks: 14,
    currentStep: "Final Review & Sign-off",
    daysInOnboarding: 29,
  },
];

function ProgressBar({ percent }: { percent: number }) {
  let barColor = "bg-blue-500";
  if (percent >= 80) barColor = "bg-emerald-500";
  else if (percent >= 50) barColor = "bg-amber-500";

  return (
    <div className="w-full h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Onboarding</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Track and manage new employee onboarding progress
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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

      {/* Active Onboarding */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Active Onboarding
        </h2>
      </div>
      <div className="space-y-4">
        {onboardingEmployees.map((emp) => (
          <div
            key={emp.name}
            className={cn(
              "rounded-xl p-5",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                  <p className="font-semibold text-[var(--color-text-primary)] truncate">
                    {emp.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">{emp.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {emp.department}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Started {emp.startDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="sm:w-64 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {emp.progress}%
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {emp.tasksCompleted}/{emp.totalTasks} tasks
                  </span>
                </div>
                <ProgressBar percent={emp.progress} />
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                  Current: {emp.currentStep}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 text-[var(--color-text-muted)] hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
        {[
          {
            name: "Tom Nguyen",
            initials: "TN",
            avatarColor: "bg-sky-500",
            title: "QA Engineer",
            department: "Engineering",
            completedDate: "Jan 31, 2025",
          },
          {
            name: "Ana Sousa",
            initials: "AS",
            avatarColor: "bg-lime-500",
            title: "HR Coordinator",
            department: "Human Resources",
            completedDate: "Jan 24, 2025",
          },
        ].map((emp) => (
          <div
            key={emp.name}
            className={cn(
              "rounded-xl p-4",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0",
                  emp.avatarColor
                )}
              >
                {emp.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{emp.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {emp.title} · {emp.department}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Completed</span>
                <span className="text-[var(--color-text-muted)] ml-1">{emp.completedDate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
