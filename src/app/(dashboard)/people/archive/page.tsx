import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getArchivedEmployees } from "@/lib/actions/employees";
import { ArchiveActions } from "@/components/people/archive-actions";

export default async function EmployeeArchivePage() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    redirect("/people");
  }

  const archived = await getArchivedEmployees();

  return (
    <div className="max-w-6xl mx-auto p-8 lg:p-12">
      <div className="mb-10">
        <Link href="/people" className="text-sm text-[var(--color-on-surface-variant)] hover:underline">
          ← Back to People
        </Link>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">
          Employee Archive
        </h2>
        <p className="text-[var(--color-on-surface-variant)] font-medium">
          {archived.length} archived {archived.length === 1 ? "employee" : "employees"}. Visible to super admins only.
        </p>
      </div>

      {archived.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-on-surface-variant)]">
          No archived employees.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-background)] text-left text-xs uppercase tracking-wide text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Archived</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((emp) => (
                <tr key={emp.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-semibold">
                    {emp.firstName} {emp.lastName}
                    <div className="text-xs font-normal text-[var(--color-on-surface-variant)]">{emp.email}</div>
                  </td>
                  <td className="px-4 py-3">{emp.jobTitle}</td>
                  <td className="px-4 py-3">{emp.department?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-on-surface-variant)]">
                    {emp.archivedAt ? new Date(emp.archivedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-on-surface-variant)]">{emp.archivedReason ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ArchiveActions id={emp.id} name={`${emp.firstName} ${emp.lastName}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
