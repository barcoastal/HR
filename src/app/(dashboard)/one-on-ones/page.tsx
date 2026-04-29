import { listOneOnOnes } from "@/lib/actions/one-on-ones";
import { requireAuth } from "@/lib/auth-helpers";
import { OneOnOnesView } from "@/components/one-on-ones/one-on-ones-view";

export const dynamic = "force-dynamic";

export default async function OneOnOnesPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;
  const meetings = await listOneOnOnes();

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">1:1 Reviews</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Recurring performance check-ins between managers and direct reports.
        </p>
      </div>
      <OneOnOnesView
        meetings={meetings.map((m) => ({
          id: m.id,
          type: m.type,
          status: m.status,
          scheduledAt: m.scheduledAt.toISOString(),
          completedAt: m.completedAt?.toISOString() || null,
          meetingLink: m.meetingLink,
          employee: m.employee,
          manager: m.manager,
        }))}
        currentEmployeeId={myEmployeeId || null}
        currentRole={role || "EMPLOYEE"}
      />
    </div>
  );
}
