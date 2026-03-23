"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { approvePayrollRun } from "@/lib/actions/gusto";
import type { GustoPayroll } from "@/lib/gusto";

type Props = {
  payrolls: GustoPayroll[];
  onViewDetail?: (payrollId: string) => void;
};

export function PayrollList({ payrolls, onViewDetail }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleApprove(payrollId: string) {
    startTransition(async () => {
      await approvePayrollRun(payrollId);
    });
  }

  const statusBadge = (p: GustoPayroll) => {
    if (p.processed) return <Badge variant="success">Processed</Badge>;
    return <Badge variant="warning">Unprocessed</Badge>;
  };

  if (payrolls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No payroll runs found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="payments" size={20} />
          Payroll Runs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payrolls.map((p) => (
            <div
              key={p.payroll_uuid}
              className="flex items-center justify-between rounded-lg px-4 py-3 bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              onClick={() => onViewDetail?.(p.payroll_uuid)}
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {p.pay_period.start_date} — {p.pay_period.end_date}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Check date: {p.check_date}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {p.totals && (
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    ${parseFloat(p.totals.gross_pay || "0").toLocaleString()}
                  </span>
                )}
                {statusBadge(p)}
                {!p.processed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(p.payroll_uuid);
                    }}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
