import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";

export default async function PeoplePage() {
  await requireAuth();
  const [employees, departments] = await Promise.all([
    getEmployees({ status: undefined }),
    getDepartments(),
  ]);

  const deptNames = departments.map((d) => d.name);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">People</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {employees.length} team member{employees.length !== 1 ? "s" : ""} across the organization
          </p>
        </div>
        <AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">
            No employees yet. Add your first team member to get started.
          </p>
        </div>
      ) : (
        <PeopleList
          employees={employees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            jobTitle: e.jobTitle,
            status: e.status,
            department: e.department ? { name: e.department.name } : null,
          }))}
          departments={deptNames}
        />
      )}
    </div>
  );
}
