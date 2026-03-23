import { requireAdmin } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { getGustoConnection, getPayrolls, getGustoTimeOffRequests, getGustoEmployeeList } from "@/lib/actions/gusto";
import { db } from "@/lib/db";
import { GustoDashboardClient } from "@/components/gusto/gusto-dashboard-client";
import type { GustoPayroll, GustoTimeOffRequest } from "@/lib/gusto";

export default async function GustoDashboardPage() {
  await requireAdmin();

  const connection = await getGustoConnection();

  if (!connection) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <PageHeader title="Gusto" description="Payroll & time-off management" />
        <GustoConnectionStatus connected={false} />
      </div>
    );
  }

  const stale = connection.tokenExpiresAt.getTime() === 0;

  if (stale) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <PageHeader title="Gusto" description="Payroll & time-off management" />
        <GustoConnectionStatus connected stale companyName={connection.companyName} connectedAt={connection.createdAt} />
      </div>
    );
  }

  let payrolls: GustoPayroll[] = [];
  let pendingRequests: GustoTimeOffRequest[] = [];
  let gustoEmployeeCount = 0;
  let payrollError: string | null = null;
  let timeOffError: string | null = null;

  const results = await Promise.allSettled([
    getPayrolls(),
    getGustoTimeOffRequests("pending"),
    getGustoEmployeeList(),
  ]);

  if (results[0].status === "fulfilled") payrolls = results[0].value;
  else payrollError = "Failed to load payroll data";

  if (results[1].status === "fulfilled") pendingRequests = results[1].value;
  else timeOffError = "Failed to load time-off requests";

  if (results[2].status === "fulfilled") gustoEmployeeCount = results[2].value.length;

  const mappedEmps = await db.employee.findMany({
    where: { gustoEmployeeId: { not: null } },
    select: { gustoEmployeeId: true, firstName: true, lastName: true },
  });
  const nameMap = new Map(
    mappedEmps.map((e) => [e.gustoEmployeeId!, `${e.firstName} ${e.lastName}`])
  );

  const nextPayroll = payrolls.find((p) => !p.processed);
  const nextPayDate = nextPayroll?.check_date || "—";

  return (
    <div className="mx-auto max-w-4xl p-8 space-y-6">
      <PageHeader title="Gusto" description="Payroll & time-off management" />

      <GustoConnectionStatus connected companyName={connection.companyName} connectedAt={connection.createdAt} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Next Payroll"
          value={nextPayDate}
          icon={<span className="material-symbols-outlined">calendar_today</span>}
        />
        <StatCard
          title="Pending Requests"
          value={String(pendingRequests.length)}
          icon={<span className="material-symbols-outlined">pending_actions</span>}
        />
        <StatCard
          title="Gusto Employees"
          value={String(gustoEmployeeCount)}
          icon={<span className="material-symbols-outlined">group</span>}
        />
      </div>

      <GustoDashboardClient
        payrolls={payrolls}
        pendingRequests={pendingRequests}
        employeeNames={Object.fromEntries(nameMap)}
        payrollError={payrollError}
        timeOffError={timeOffError}
      />
    </div>
  );
}
