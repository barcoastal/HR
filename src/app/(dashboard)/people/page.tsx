import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function PeoplePage() {
  await requireAuth();
  const [employees, departments] = await Promise.all([
    getEmployees({ status: undefined }),
    getDepartments(),
  ]);

  const deptNames = departments.map((d) => d.name);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="People"
        description={`${employees.length} team member${employees.length !== 1 ? "s" : ""} across the organization`}
        action={<AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />}
      />

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
