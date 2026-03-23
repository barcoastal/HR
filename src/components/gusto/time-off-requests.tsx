"use client";

import { useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { approveTimeOff, denyTimeOff } from "@/lib/actions/gusto";
import type { GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  requests: GustoTimeOffRequest[];
  employeeNames?: Map<string, string>;
};

export function TimeOffRequests({ requests, employeeNames }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleApprove(uuid: string) {
    startTransition(async () => {
      await approveTimeOff(uuid);
    });
  }

  function handleDeny(uuid: string) {
    startTransition(async () => {
      await denyTimeOff(uuid);
    });
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No pending time off requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="beach_access" size={20} />
          Pending Time Off Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.uuid} className="flex items-center justify-between rounded-lg px-4 py-3 bg-[var(--color-surface-container)]">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {employeeNames?.get(r.employee_uuid) || r.employee_uuid.slice(0, 8)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {r.start_date} — {r.end_date} · {r.request_type}
                </p>
                {r.employee_note && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">&quot;{r.employee_note}&quot;</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{r.days} day{r.days !== 1 ? "s" : ""}</Badge>
                <Button variant="secondary" size="sm" onClick={() => handleApprove(r.uuid)} disabled={isPending}>
                  <Icon name="check" size={16} className="mr-1" />
                  Approve
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeny(r.uuid)} disabled={isPending}>
                  <Icon name="close" size={16} className="mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
