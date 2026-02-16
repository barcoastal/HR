"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createTimeOffRequest } from "@/lib/actions/time-off";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type Policy = { id: string; name: string; daysPerYear: number; isUnlimited: boolean };
type Balance = { policyId: string; used: number; policy: Policy };

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function RequestTimeOffDialog({
  employeeId,
  policies,
  balances,
}: {
  employeeId: string;
  policies: Policy[];
  balances: Balance[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    policyId: policies[0]?.id || "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const router = useRouter();

  const daysCount = form.startDate && form.endDate
    ? countWeekdays(new Date(form.startDate), new Date(form.endDate))
    : 0;

  const selectedBalance = balances.find((b) => b.policyId === form.policyId);
  const selectedPolicy = policies.find((p) => p.id === form.policyId);
  const remaining = selectedPolicy
    ? selectedPolicy.isUnlimited
      ? Infinity
      : selectedPolicy.daysPerYear - (selectedBalance?.used || 0)
    : 0;

  async function handleSubmit() {
    if (!form.policyId || !form.startDate || !form.endDate || daysCount <= 0) return;
    setSaving(true);
    await createTimeOffRequest({
      employeeId,
      policyId: form.policyId,
      startDate: form.startDate,
      endDate: form.endDate,
      daysCount,
      reason: form.reason || undefined,
    });
    setSaving(false);
    setOpen(false);
    setForm({ policyId: policies[0]?.id || "", startDate: "", endDate: "", reason: "" });
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)] text-white",
          "hover:bg-[var(--color-accent-hover)] transition-colors"
        )}
      >
        <Plus className="h-4 w-4" />Request Time Off
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Request Time Off">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Policy</label>
            <select
              value={form.policyId}
              onChange={(e) => setForm((f) => ({ ...f, policyId: e.target.value }))}
              className={inputClass}
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.isUnlimited ? "(Unlimited)" : `(${p.daysPerYear} days/year)`}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} min={form.startDate} className={inputClass} />
            </div>
          </div>
          {daysCount > 0 && (
            <div className={cn("p-3 rounded-lg text-sm", "bg-[var(--color-accent)]/10 text-[var(--color-accent)]")}>
              {daysCount} weekday{daysCount !== 1 ? "s" : ""} · {remaining === Infinity ? "Unlimited" : `${remaining} days remaining`}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="Vacation, personal day, etc."
              className={cn(inputClass, "resize-none")}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || daysCount <= 0 || !form.policyId}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
