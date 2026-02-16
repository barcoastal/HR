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
import { Palmtree } from "lucide-react";
import { TimeOffTabs } from "@/components/time-off/time-off-tabs";

export default async function TimeOffPage() {
  const session = await requireAuth();
  const role = (session.user.role || "EMPLOYEE") as UserRole;
  const employeeId = session.user.employeeId || "";
  const isApprover = canApproveTimeOff(role);
  const now = new Date();
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

  const [balances, myRequests, allRequests, calendarEntries, burnoutEmployees] = await Promise.all([
    employeeId ? getEmployeeBalances(employeeId, currentYear) : Promise.resolve([]),
    employeeId ? getTimeOffRequests({ employeeId }) : Promise.resolve([]),
    isApprover ? getTimeOffRequests() : Promise.resolve([]),
    getTeamCalendar(currentYear, currentMonth),
    isApprover ? getBurnoutAlerts() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Time Off</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage your time off and view team availability</p>
        </div>
        {employeeId && policies.length > 0 && (
          <RequestTimeOffDialog
            employeeId={employeeId}
            policies={policies.map((p) => ({ id: p.id, name: p.name, daysPerYear: p.daysPerYear, isUnlimited: p.isUnlimited }))}
            balances={balances.map((b) => ({ policyId: b.policyId, used: b.used, policy: { id: b.policy.id, name: b.policy.name, daysPerYear: b.policy.daysPerYear, isUnlimited: b.policy.isUnlimited } }))}
          />
        )}
      </div>

      {/* Balance Stats */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {balances.map((b) => {
            const remaining = b.policy.isUnlimited ? null : b.policy.daysPerYear - b.used;
            return (
              <div key={b.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <div className="flex items-center gap-2 mb-2">
                  <Palmtree className="h-4 w-4 text-emerald-500" />
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
        <div className={cn("rounded-xl p-8 text-center mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <Palmtree className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">No time off policies configured yet. Ask your admin to set them up in Settings.</p>
        </div>
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
    </div>
  );
}
