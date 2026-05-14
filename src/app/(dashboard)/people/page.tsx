import Link from "next/link";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";
import { BulkEmployeeImport } from "@/components/people/bulk-employee-import";

export default async function PeoplePage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [allEmployees, departments] = await Promise.all([
    getEmployees({ status: undefined }),
    getDepartments(),
  ]);

  // Only admins see PENDING employees
  const employees = isAdmin
    ? allEmployees
    : allEmployees.filter((e) => e.status !== "PENDING");

  const departmentsWithCounts = departments.map((d) => ({
    name: d.name,
    memberCount: employees.filter((e) => e.department?.name === d.name).length,
  }));

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-12">
      <div className="mb-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-5xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">People</h2>
            <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">
              Managing {employees.length} talented individuals across {departments.length} departments.
            </p>
          </div>
          <div className="flex gap-3">
            {isSuperAdmin && (
              <Link
                href="/people/archive"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-background)] transition-colors"
              >
                Archive
              </Link>
            )}
            {isAdmin && (
              <>
                <BulkEmployeeImport departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
                <AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
              </>
            )}
          </div>
        </div>
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
            pronouns: e.pronouns,
            profilePhoto: e.profilePhoto,
            department: e.department ? { name: e.department.name } : null,
          }))}
          departments={departmentsWithCounts}
        />
      )}
    </div>
  );
}
