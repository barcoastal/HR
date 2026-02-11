import { cn } from "@/lib/utils";
import { Search, Mail, Filter } from "lucide-react";

const departments = ["All", "Engineering", "Design", "Marketing", "HR", "Product", "Finance"];

const employees = [
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    initials: "SC",
    title: "HR Director",
    department: "HR",
    email: "sarah.chen@peoplehub.io",
    avatarColor: "bg-indigo-500",
    status: "online" as const,
  },
  {
    id: "alex-rivera",
    name: "Alex Rivera",
    initials: "AR",
    title: "Engineering Manager",
    department: "Engineering",
    email: "alex.rivera@peoplehub.io",
    avatarColor: "bg-emerald-500",
    status: "online" as const,
  },
  {
    id: "emma-wilson",
    name: "Emma Wilson",
    initials: "EW",
    title: "Product Designer",
    department: "Design",
    email: "emma.wilson@peoplehub.io",
    avatarColor: "bg-rose-500",
    status: "online" as const,
  },
  {
    id: "mike-johnson",
    name: "Mike Johnson",
    initials: "MJ",
    title: "Senior Engineer",
    department: "Engineering",
    email: "mike.johnson@peoplehub.io",
    avatarColor: "bg-amber-500",
    status: "away" as const,
  },
  {
    id: "priya-patel",
    name: "Priya Patel",
    initials: "PP",
    title: "Marketing Lead",
    department: "Marketing",
    email: "priya.patel@peoplehub.io",
    avatarColor: "bg-purple-500",
    status: "online" as const,
  },
  {
    id: "james-oconnor",
    name: "James O'Connor",
    initials: "JO",
    title: "Product Manager",
    department: "Product",
    email: "james.oconnor@peoplehub.io",
    avatarColor: "bg-cyan-500",
    status: "offline" as const,
  },
  {
    id: "luna-martinez",
    name: "Luna Martinez",
    initials: "LM",
    title: "UX Researcher",
    department: "Design",
    email: "luna.martinez@peoplehub.io",
    avatarColor: "bg-pink-500",
    status: "online" as const,
  },
  {
    id: "david-kim",
    name: "David Kim",
    initials: "DK",
    title: "Finance Analyst",
    department: "Finance",
    email: "david.kim@peoplehub.io",
    avatarColor: "bg-teal-500",
    status: "away" as const,
  },
];

const statusColors = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-gray-400",
};

const departmentColors: Record<string, string> = {
  Engineering: "bg-blue-500/15 text-blue-400",
  Design: "bg-pink-500/15 text-pink-400",
  Marketing: "bg-purple-500/15 text-purple-400",
  HR: "bg-indigo-500/15 text-indigo-400",
  Product: "bg-cyan-500/15 text-cyan-400",
  Finance: "bg-teal-500/15 text-teal-400",
};

export default function PeoplePage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">People</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {employees.length} team members across the organization
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search by name, title, or department..."
          className={cn(
            "w-full pl-10 pr-4 py-2.5 rounded-lg text-sm",
            "bg-[var(--color-surface)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
            "transition-all"
          )}
        />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
        {departments.map((dept, idx) => (
          <button
            key={dept}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              idx === 0
                ? "bg-[var(--color-accent)] text-white shadow-[0_0_10px_var(--color-accent-glow)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((employee) => (
          <a
            key={employee.id}
            href={`/people/${employee.id}`}
            className={cn(
              "rounded-xl p-5",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)]/30",
              "transition-all group"
            )}
          >
            <div className="flex items-start gap-4">
              {/* Avatar with Status */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold",
                    employee.avatarColor
                  )}
                >
                  {employee.initials}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)]",
                    statusColors[employee.status]
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                  {employee.name}
                </p>
                <p className="text-sm text-[var(--color-text-muted)] truncate">{employee.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      departmentColors[employee.department]
                    )}
                  >
                    {employee.department}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{employee.email}</span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
