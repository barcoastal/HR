import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, Users, Layers, Pencil, Trash2 } from "lucide-react";

const departments = [
  {
    name: "Engineering",
    head: "Alex Rivera",
    headInitials: "AR",
    headColor: "bg-emerald-500",
    members: 18,
    teams: 4,
    teamNames: ["Platform", "Frontend", "Backend", "DevOps"],
  },
  {
    name: "Product",
    head: "James O'Connor",
    headInitials: "JO",
    headColor: "bg-cyan-500",
    members: 8,
    teams: 2,
    teamNames: ["Core Product", "Growth"],
  },
  {
    name: "Design",
    head: "Luna Martinez",
    headInitials: "LM",
    headColor: "bg-pink-500",
    members: 6,
    teams: 2,
    teamNames: ["Product Design", "Brand"],
  },
  {
    name: "Marketing",
    head: "Priya Patel",
    headInitials: "PP",
    headColor: "bg-purple-500",
    members: 7,
    teams: 2,
    teamNames: ["Content", "Growth Marketing"],
  },
  {
    name: "Human Resources",
    head: "Sarah Chen",
    headInitials: "SC",
    headColor: "bg-indigo-500",
    members: 5,
    teams: 1,
    teamNames: ["People Ops"],
  },
  {
    name: "Finance",
    head: "David Kim",
    headInitials: "DK",
    headColor: "bg-teal-500",
    members: 4,
    teams: 1,
    teamNames: ["Accounting"],
  },
];

export default function DepartmentsPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Departments</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Manage departments, their heads, and team structures
          </p>
        </div>
        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "shadow-[0_0_12px_var(--color-accent-glow)]"
          )}
        >
          <Plus className="h-4 w-4" />
          Add Department
        </button>
      </div>

      {/* Table — Desktop */}
      <div
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "hidden md:block"
        )}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Department
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Head
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Teams
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Members
              </th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {departments.map((dept) => (
              <tr
                key={dept.name}
                className="hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {dept.name}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                        dept.headColor
                      )}
                    >
                      {dept.headInitials}
                    </div>
                    <span className="text-sm text-[var(--color-text-primary)]">{dept.head}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-primary)]">{dept.teams}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      ({dept.teamNames.join(", ")})
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-primary)]">{dept.members}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                      aria-label={`Edit ${dept.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card list — Mobile */}
      <div className="md:hidden space-y-3">
        {departments.map((dept) => (
          <div
            key={dept.name}
            className={cn(
              "rounded-xl p-4",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {dept.name}
              </h3>
              <button
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                  dept.headColor
                )}
              >
                {dept.headInitials}
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">{dept.head}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Department Head</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {dept.members} members
              </div>
              <div className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {dept.teams} teams
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
