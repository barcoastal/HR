"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { requestTimeOff, getGustoTimeOffPolicies } from "@/lib/actions/gusto";
import type { GustoTimeOffPolicy } from "@/lib/gusto";

type Props = {
  gustoEmployeeId: string;
};

export function GustoTimeOffForm({ gustoEmployeeId }: Props) {
  const [policies, setPolicies] = useState<GustoTimeOffPolicy[]>([]);
  const [policyUuid, setPolicyUuid] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGustoTimeOffPolicies().then(setPolicies).catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await requestTimeOff({
          gustoEmployeeId,
          timeOffPolicyUuid: policyUuid,
          startDate,
          endDate,
          note,
        });
        setSuccess(true);
        setPolicyUuid("");
        setStartDate("");
        setEndDate("");
        setNote("");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to submit request");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon name="add_circle" size={18} />
          Request Time Off
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              value={policyUuid}
              onChange={(e) => setPolicyUuid(e.target.value)}
              required
            >
              <option value="">Select type...</option>
              {policies.map((p) => (
                <option key={p.uuid} value={p.uuid}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Start Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)]">End Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Note (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Time off request submitted!</p>}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
