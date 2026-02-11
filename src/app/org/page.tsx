import { cn } from "@/lib/utils";
import { Users, Building2, Layers, Clock, ChevronRight } from "lucide-react";

const stats = [
  {
    label: "Total Employees",
    value: "48",
    icon: Users,
    change: "+3 this month",
    changeType: "positive",
  },
  {
    label: "Departments",
    value: "6",
    icon: Building2,
    change: "Stable",
    changeType: "neutral",
  },
  {
    label: "Teams",
    value: "12",
    icon: Layers,
    change: "+1 this quarter",
    changeType: "positive",
  },
  {
    label: "Avg Tenure",
    value: "2.3 yrs",
    icon: Clock,
    change: "+0.2 from last year",
    changeType: "positive",
  },
];

const departments = [
  {
    name: "Engineering",
    head: "Alex Rivera",
    headInitials: "AR",
    headColor: "bg-emerald-500",
    members: 18,
    teams: 4,
    borderColor: "border-l-blue-500",
    description: "Building and maintaining core platform, infrastructure, and developer tooling.",
  },
  {
    name: "Product",
    head: "James O'Connor",
    headInitials: "JO",
    headColor: "bg-cyan-500",
    members: 8,
    teams: 2,
    borderColor: "border-l-cyan-500",
    description: "Defining product strategy, roadmap, and cross-functional alignment.",
  },
  {
    name: "Design",
    head: "Luna Martinez",
    headInitials: "LM",
    headColor: "bg-pink-500",
    members: 6,
    teams: 2,
    borderColor: "border-l-pink-500",
    description: "User experience research, product design, and brand design systems.",
  },
  {
    name: "Marketing",
    head: "Priya Patel",
    headInitials: "PP",
    headColor: "bg-purple-500",
    members: 7,
    teams: 2,
    borderColor: "border-l-purple-500",
    description: "Growth marketing, content strategy, events, and brand communications.",
  },
  {
    name: "Human Resources",
    head: "Sarah Chen",
    headInitials: "SC",
    headColor: "bg-indigo-500",
    members: 5,
    teams: 1,
    borderColor: "border-l-indigo-500",
    description: "People operations, talent acquisition, culture, and employee experience.",
  },
  {
    name: "Finance",
    head: "David Kim",
    headInitials: "DK",
    headColor: "bg-teal-500",
    members: 4,
    teams: 1,
    borderColor: "border-l-teal-500",
    description: "Financial planning, accounting, payroll, and compliance.",
  },
];

export default function OrgPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Organization</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Overview of your company structure and departments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
              <p
                className={cn(
                  "text-xs mt-2",
                  stat.changeType === "positive"
                    ? "text-emerald-400"
                    : "text-[var(--color-text-muted)]"
                )}
              >
                {stat.change}
              </p>
            </div>
          );
        })}
      </div>

      {/* Departments Grid */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Departments</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.name}
            className={cn(
              "rounded-xl overflow-hidden",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "border-l-4",
              dept.borderColor,
              "hover:bg-[var(--color-surface-hover)] transition-colors group cursor-pointer"
            )}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {dept.name}
                </h3>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2">
                {dept.description}
              </p>

              {/* Head */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                    dept.headColor
                  )}
                >
                  {dept.headInitials}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {dept.head}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Department Head</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 pt-3 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {dept.members}
                    </span>{" "}
                    members
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {dept.teams}
                    </span>{" "}
                    teams
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
