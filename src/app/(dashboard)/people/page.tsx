import { redirect } from "next/navigation";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { getCurrentOutOfOfficeFor } from "@/lib/actions/out-of-office";
import { displayName } from "@/lib/utils";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";

export default async function PeoplePage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";

  // Employees may not browse the company directory — only their own profile.
  // Managers and above can see the list (used for org/team navigation).
  if (!isAdmin && role !== "MANAGER") {
    redirect("/my-profile");
  }

  const [allEmployees, departments] = await Promise.all([
    getEmployees({ status: undefined }),
    getDepartments(),
  ]);

  // Only admins see PENDING employees
  const employees = isAdmin ? allEmployees : allEmployees.filter((e) => e.status !== "PENDING");

  const departmentsWithCounts = departments.map((d) => ({
    name: d.name,
    memberCount: employees.filter((e) => e.department?.name === d.name).length,
  }));

  const outOfOffice = await getCurrentOutOfOfficeFor(employees.map((e) => e.id));

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-12">
      <div className="mb-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-5xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">People</h2>
            <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">
              {employees.length} people across {departments.length} departments.
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && <AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />}
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
            preferredName: e.preferredName,
            email: e.email,
            jobTitle: e.jobTitle,
            status: e.status,
            pronouns: e.pronouns,
            profilePhoto: e.profilePhoto,
            department: e.department ? { name: e.department.name } : null,
            manager: e.manager ? { id: e.manager.id, name: displayName(e.manager) } : null,
            startDate: e.startDate.toISOString(),
          }))}
          departments={departmentsWithCounts}
          outOfOffice={outOfOffice}
        />
      )}
    </div>
  );
}
