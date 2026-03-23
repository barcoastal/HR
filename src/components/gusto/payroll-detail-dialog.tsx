"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPayrollDetail } from "@/lib/actions/gusto";
import type { GustoPayroll } from "@/lib/gusto";

type Props = {
  payrollId: string | null;
  onClose: () => void;
};

export function PayrollDetailDialog({ payrollId, onClose }: Props) {
  const [detail, setDetail] = useState<GustoPayroll | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payrollId) return;
    setLoading(true);
    setError(null);
    getPayrollDetail(payrollId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [payrollId]);

  if (!payrollId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Payroll Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="close" size={20} />
          </Button>
        </div>

        {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)]">Pay Period</p>
                <p className="font-medium">{detail.pay_period.start_date} — {detail.pay_period.end_date}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Check Date</p>
                <p className="font-medium">{detail.check_date}</p>
              </div>
              {detail.totals && (
                <>
                  <div>
                    <p className="text-[var(--color-text-muted)]">Gross Pay</p>
                    <p className="font-semibold">${parseFloat(detail.totals.gross_pay || "0").toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)]">Net Pay</p>
                    <p className="font-semibold">${parseFloat(detail.totals.net_pay || "0").toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>

            {detail.employee_compensations && detail.employee_compensations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Employee Breakdown</h3>
                <div className="space-y-1">
                  {detail.employee_compensations.map((ec) => (
                    <div key={ec.employee_uuid} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                      <span className="text-[var(--color-text-muted)] font-mono text-xs">{ec.employee_uuid.slice(0, 8)}...</span>
                      <div className="flex gap-4">
                        <span>Gross: ${parseFloat(ec.gross_pay || "0").toLocaleString()}</span>
                        <span>Net: ${parseFloat(ec.net_pay || "0").toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
