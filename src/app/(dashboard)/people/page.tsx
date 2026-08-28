import { redirect } from "next/navigation";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { getCurrentOutOfOfficeFor } from "@/lib/actions/out-of-office";
import { isGustoConnected } from "@/lib/actions/gusto";
import { displayName } from "@/lib/utils";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";
import { PendingPeople } from "@/components/people/pending-people";
import { employeeToRowData } from "@/lib/import-export/employee-row";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
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

  const pendingPeople = employees.filter((e) => e.status === "PENDING");
  const activePeople = employees.filter((e) => e.status !== "PENDING");
  const showPending = isAdmin && tab === "pending";
  // The Pending tab can compare people with Gusto; only worth asking when that tab is shown.
  const gustoConnected = showPending ? await isGustoConnected() : false;

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
              {activePeople.length} people across {departments.length} departments.
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin && <AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />}
          </div>
        </div>
      </div>

      {isAdmin && pendingPeople.length > 0 && (
        <nav aria-label="People sections" className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
          {[{ id: "all", label: `People (${activePeople.length})`, href: "/people" }, { id: "pending", label: `Pending (${pendingPeople.length})`, href: "/people?tab=pending" }].map((t) => {
            const selected = showPending ? t.id === "pending" : t.id === "all";
            return (
              <Link key={t.id} href={t.href} aria-current={selected ? "page" : undefined}
                className={cn("relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                  selected ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                {t.label}
                {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />}
              </Link>
            );
          })}
        </nav>
      )}

      {showPending ? (
        <PendingPeople
          people={pendingPeople.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            preferredName: e.preferredName,
            email: e.email,
            jobTitle: e.jobTitle,
            department: e.department?.name ?? null,
            createdAt: e.createdAt.toISOString(),
            data: employeeToRowData(e),
          }))}
          gustoConnected={gustoConnected}
        />
      ) : activePeople.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">
            No employees yet. Add your first team member to get started.
          </p>
        </div>
      ) : (
        <PeopleList
          employees={activePeople.map((e) => ({
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
