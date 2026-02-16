import { cn, getInitials } from "@/lib/utils";
import { getDepartments } from "@/lib/actions/departments";
import { getEmployees } from "@/lib/actions/employees";
import { requireAuth } from "@/lib/auth-helpers";
import { Users, Layers } from "lucide-react";
import { DepartmentActions, DepartmentRowActions } from "@/components/org/department-actions";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export default async function DepartmentsPage() {
  await requireAuth();
  const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);

  const employeeList = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    jobTitle: e.jobTitle,
  }));

  const deptList = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    headId: d.headId,
    head: d.head ? { firstName: d.head.firstName, lastName: d.head.lastName } : null,
    teams: d.teams.map((t) => t.name),
    memberCount: d.employees.length,
  }));

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Departments</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage departments, their heads, and team structures</p>
        </div>
        <DepartmentActions departments={deptList} employees={employeeList} />
      </div>

      <div className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", "hidden md:block")}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Department</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Head</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Teams</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Members</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {departments.map((dept) => {
              const headInitials = dept.head ? getInitials(dept.head.firstName, dept.head.lastName) : "??";
              const colorIdx = dept.head ? dept.head.firstName.charCodeAt(0) % avatarColors.length : 0;
              const deptInfo = deptList.find((d) => d.id === dept.id)!;
              return (
                <tr key={dept.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-5 py-4"><p className="text-sm font-semibold text-[var(--color-text-primary)]">{dept.name}</p></td>
                  <td className="px-5 py-4">
                    {dept.head ? (
                      <div className="flex items-center gap-2">
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{headInitials}</div>
                        <span className="text-sm text-[var(--color-text-primary)]">{dept.head.firstName} {dept.head.lastName}</span>
                      </div>
                    ) : <span className="text-sm text-[var(--color-text-muted)]">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      <span className="text-sm text-[var(--color-text-primary)]">{dept.teams.length}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-1">({dept.teams.map((t) => t.name).join(", ")})</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      <span className="text-sm text-[var(--color-text-primary)]">{dept.employees.length}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <DepartmentRowActions department={deptInfo} employees={employeeList} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {departments.map((dept) => {
          const headInitials = dept.head ? getInitials(dept.head.firstName, dept.head.lastName) : "??";
          const colorIdx = dept.head ? dept.head.firstName.charCodeAt(0) % avatarColors.length : 0;
          const deptInfo = deptList.find((d) => d.id === dept.id)!;
          return (
            <div key={dept.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{dept.name}</h3>
                <DepartmentRowActions department={deptInfo} employees={employeeList} />
              </div>
              {dept.head && (
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{headInitials}</div>
                  <div>
                    <p className="text-sm text-[var(--color-text-primary)]">{dept.head.firstName} {dept.head.lastName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Department Head</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{dept.employees.length} members</div>
                <div className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{dept.teams.length} teams</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
