import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getTimeOffPolicies,
  getEmployeeBalances,
  getTimeOffRequests,
  getWhosOutToday,
  getTeamCalendar,
  getBurnoutAlerts,
  assignPolicyToEmployee,
} from "@/lib/actions/time-off";
import { canApproveTimeOff } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";
import { RequestTimeOffDialog } from "@/components/time-off/request-time-off-dialog";
import { RequestList } from "@/components/time-off/request-list";
import { WhosOutWidget } from "@/components/time-off/whos-out-widget";
import { TeamCalendar } from "@/components/time-off/team-calendar";
import { BurnoutAlerts } from "@/components/time-off/burnout-alerts";
import { TimeOffTabs } from "@/components/time-off/time-off-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { GustoTimeOffForm } from "@/components/gusto/gusto-time-off-form";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { getEmployeeTimeOffBalances, isGustoConnected, getGustoTimeOffRequests } from "@/lib/actions/gusto";
import { TimeOffRequests } from "@/components/gusto/time-off-requests";
import { db } from "@/lib/db";
import type { GustoTimeOffBalance, GustoTimeOffRequest as GustoTORequest } from "@/lib/gusto";

export default async function TimeOffPage() {
  const session = await requireAuth();
  const role = (session.user.role || "EMPLOYEE") as UserRole;
  const employeeId = session.user.employeeId || "";
  const isApprover = canApproveTimeOff(role);
  const now = new Date();

  // Check if current employee is mapped to Gusto
  const currentEmployee = await db.employee.findFirst({
    where: { id: employeeId },
    select: { gustoEmployeeId: true },
  });
  const gustoConnected = await isGustoConnected();
  const isGustoMapped = gustoConnected && !!currentEmployee?.gustoEmployeeId;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [policies, outToday] = await Promise.all([
    getTimeOffPolicies(),
    getWhosOutToday(),
  ]);

  // Ensure employee has balances for all policies
  if (employeeId) {
    for (const policy of policies) {
      await assignPolicyToEmployee(employeeId, policy.id, currentYear);
    }
  }

  let gustoBalances: GustoTimeOffBalance[] = [];
  if (isGustoMapped && currentEmployee?.gustoEmployeeId) {
    try {
      gustoBalances = await getEmployeeTimeOffBalances(currentEmployee.gustoEmployeeId);
    } catch {
      // Gusto API error — fall through to local
    }
  }

  // Admin: also fetch Gusto pending requests
  let gustoPendingRequests: GustoTORequest[] = [];
  if (isApprover && gustoConnected) {
    try {
      gustoPendingRequests = await getGustoTimeOffRequests("pending");
    } catch {
      // Gusto API unavailable
    }
  }

  const [balances, myRequests, allRequests, calendarEntries, burnoutEmployees] = await Promise.all([
    employeeId ? getEmployeeBalances(employeeId, currentYear) : Promise.resolve([]),
    employeeId ? getTimeOffRequests({ employeeId }) : Promise.resolve([]),
    isApprover ? getTimeOffRequests() : Promise.resolve([]),
    getTeamCalendar(currentYear, currentMonth),
    isApprover ? getBurnoutAlerts() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader
        title="Time Off"
        description="Manage your time off and view team availability"
        action={
          employeeId && policies.length > 0 ? (
            <RequestTimeOffDialog
              employeeId={employeeId}
              policies={policies.map((p) => ({ id: p.id, name: p.name, daysPerYear: p.daysPerYear, isUnlimited: p.isUnlimited }))}
              balances={balances.map((b) => ({ policyId: b.policyId, used: b.used, policy: { id: b.policy.id, name: b.policy.name, daysPerYear: b.policy.daysPerYear, isUnlimited: b.policy.isUnlimited } }))}
            />
          ) : undefined
        }
      />

      {/* Gusto Time Off — mapped employees */}
      {isGustoMapped && currentEmployee?.gustoEmployeeId && (
        <div className="space-y-4 mb-6">
          {gustoBalances.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {gustoBalances.map((b) => (
                <div key={b.policy_uuid} className="rounded-xl bg-[var(--color-surface-container)] p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{b.balance}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{b.policy_name}</p>
                </div>
              ))}
            </div>
          )}
          <GustoTimeOffForm gustoEmployeeId={currentEmployee.gustoEmployeeId} />
        </div>
      )}

      {/* Local Time Off — unmapped employees only */}
      {!isGustoMapped && (
        <>
          {/* Balance Stats */}
          {balances.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {balances.map((b) => {
                const remaining = b.policy.isUnlimited ? null : b.policy.daysPerYear - b.used;
                return (
                  <div key={b.id} className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-4")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="beach_access" size={16} className="text-emerald-500" />
                      <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{b.policy.name}</p>
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      {b.policy.isUnlimited ? "∞" : remaining}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {b.policy.isUnlimited ? "Unlimited" : `${b.used} used of ${b.policy.daysPerYear}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {policies.length === 0 && (
            <div className={cn("rounded-2xl p-8 text-center mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <Icon name="beach_access" size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--color-text-muted)]">No time off policies configured yet. Ask your admin to set them up in Settings.</p>
            </div>
          )}
        </>
      )}

      <TimeOffTabs
        myRequests={myRequests as any}
        allRequests={allRequests as any}
        outToday={outToday as any}
        calendarEntries={calendarEntries as any}
        burnoutEmployees={burnoutEmployees as any}
        currentEmployeeId={employeeId}
        isApprover={isApprover}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      {isApprover && gustoPendingRequests.length > 0 && (
        <TimeOffRequests requests={gustoPendingRequests} />
      )}
    </div>
  );
}
