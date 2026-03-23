"use client";

import { useState } from "react";
import { PayrollList } from "@/components/gusto/payroll-list";
import { PayrollDetailDialog } from "@/components/gusto/payroll-detail-dialog";
import { TimeOffRequests } from "@/components/gusto/time-off-requests";
import type { GustoPayroll, GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  payrolls: GustoPayroll[];
  pendingRequests: GustoTimeOffRequest[];
  employeeNames: Record<string, string>;
  payrollError: string | null;
  timeOffError: string | null;
};

export function GustoDashboardClient({ payrolls, pendingRequests, employeeNames, payrollError, timeOffError }: Props) {
  const [selectedPayroll, setSelectedPayroll] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {payrollError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{payrollError}</div>
      ) : (
        <PayrollList payrolls={payrolls} onViewDetail={setSelectedPayroll} />
      )}

      {timeOffError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{timeOffError}</div>
      ) : (
        <TimeOffRequests requests={pendingRequests} employeeNames={new Map(Object.entries(employeeNames))} />
      )}

      <PayrollDetailDialog payrollId={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
    </div>
  );
}
