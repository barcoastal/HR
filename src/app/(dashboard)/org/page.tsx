import { cn, getInitials } from "@/lib/utils";
import { getDepartments } from "@/lib/actions/departments";
import { getEmployees } from "@/lib/actions/employees";
import { requireAuth } from "@/lib/auth-helpers";
import { Users, Building2, Layers, Clock, ChevronRight } from "lucide-react";
import { ManagerAssignment } from "@/components/org/manager-assignment";

const borderColors: Record<string, string> = {
  Engineering: "border-l-blue-500",
  Product: "border-l-cyan-500",
  Design: "border-l-pink-500",
  Marketing: "border-l-purple-500",
  "Human Resources": "border-l-indigo-500",
  Finance: "border-l-teal-500",
};
const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export default async function OrgPage() {
  await requireAuth();
  const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);

  const activeEmployees = employees.filter((e) => e.status !== "OFFBOARDED");
  const avgTenure = (() => {
    if (activeEmployees.length === 0) return "0 yrs";
    const totalMonths = activeEmployees.reduce((acc, e) => acc + (Date.now() - e.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30), 0);
    return `${(totalMonths / activeEmployees.length / 12).toFixed(1)} yrs`;
  })();

  const stats = [
    { label: "Total Employees", value: String(activeEmployees.length), icon: Users },
    { label: "Departments", value: String(departments.length), icon: Building2 },
    { label: "Teams", value: String(departments.reduce((acc, d) => acc + d.teams.length, 0)), icon: Layers },
    { label: "Avg Tenure", value: avgTenure, icon: Clock },
  ];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Organization</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Overview of your company structure and departments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Departments</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const headInitials = dept.head ? getInitials(dept.head.firstName, dept.head.lastName) : "??";
          const colorIdx = dept.head ? dept.head.firstName.charCodeAt(0) % avatarColors.length : 0;
          const memberCount = dept.employees.length;
          return (
            <div key={dept.id} className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", "border-l-4", borderColors[dept.name] || "border-l-gray-500", "hover:bg-[var(--color-surface-hover)] transition-colors group cursor-pointer")}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{dept.name}</h3>
                  <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {dept.description && <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2">{dept.description}</p>}
                {dept.head && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{headInitials}</div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{dept.head.firstName} {dept.head.lastName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Department Head</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 pt-3 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]"><span className="font-medium text-[var(--color-text-primary)]">{memberCount}</span> members</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]"><span className="font-medium text-[var(--color-text-primary)]">{dept.teams.length}</span> teams</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <ManagerAssignment
          employees={activeEmployees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            jobTitle: e.jobTitle,
            departmentName: e.department?.name || null,
            managerId: e.managerId,
            managerName: e.managerId
              ? (() => {
                  const mgr = activeEmployees.find((m) => m.id === e.managerId);
                  return mgr ? `${mgr.firstName} ${mgr.lastName}` : null;
                })()
              : null,
          }))}
        />
      </div>
    </div>
  );
}
