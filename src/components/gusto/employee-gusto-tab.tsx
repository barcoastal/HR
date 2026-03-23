"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getEmployeeCompensation,
  getEmployeePayStubs,
  getEmployeeTimeOffBalances,
  getGustoTimeOffRequests,
} from "@/lib/actions/gusto";
import type { GustoCompensation, GustoPayrollEmployee, GustoTimeOffBalance, GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  gustoEmployeeId: string;
};

export function EmployeeGustoTab({ gustoEmployeeId }: Props) {
  const [compensation, setCompensation] = useState<GustoCompensation[]>([]);
  const [payStubs, setPayStubs] = useState<GustoPayrollEmployee[]>([]);
  const [balances, setBalances] = useState<GustoTimeOffBalance[]>([]);
  const [timeOffHistory, setTimeOffHistory] = useState<GustoTimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [comp, stubs, bal, history] = await Promise.allSettled([
          getEmployeeCompensation(gustoEmployeeId),
          getEmployeePayStubs(gustoEmployeeId),
          getEmployeeTimeOffBalances(gustoEmployeeId),
          getGustoTimeOffRequests(),
        ]);
        if (comp.status === "fulfilled") setCompensation(comp.value);
        if (stubs.status === "fulfilled") setPayStubs(stubs.value);
        if (bal.status === "fulfilled") setBalances(bal.value);
        if (history.status === "fulfilled") {
          setTimeOffHistory(history.value.filter((r) => r.employee_uuid === gustoEmployeeId));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load Gusto data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [gustoEmployeeId]);

  if (loading) {
    return <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading Gusto data...</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {compensation.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Compensation</CardTitle></CardHeader>
          <CardContent>
            {compensation.map((c) => (
              <div key={c.uuid} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm font-medium">${parseFloat(c.rate).toLocaleString()} / {c.payment_unit}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Effective {c.effective_date} · {c.flsa_status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {balances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Time Off Balances</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {balances.map((b) => (
                <div key={b.policy_uuid} className="rounded-lg bg-[var(--color-surface-container)] p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{b.balance}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{b.policy_name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {payStubs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Pay Stubs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {payStubs.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                  <span>Gross: ${parseFloat(s.gross_pay || "0").toLocaleString()}</span>
                  <span>Net: ${parseFloat(s.net_pay || "0").toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {timeOffHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Time Off History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {timeOffHistory.map((r) => (
                <div key={r.uuid} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                  <div>
                    <span>{r.start_date} — {r.end_date}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">{r.request_type}</span>
                  </div>
                  <Badge variant={r.status === "approved" ? "success" : r.status === "denied" ? "destructive" : "default"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
