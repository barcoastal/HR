"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { addReviewToCycle } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import type { ReviewType } from "@/generated/prisma/client";

type SimpleEmployee = { id: string; firstName: string; lastName: string };

export function AddReviewDialog({
  cycleId,
  employees,
}: {
  cycleId: string;
  employees: SimpleEmployee[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [type, setType] = useState<ReviewType>("MANAGER");
  const router = useRouter();

  async function handleAdd() {
    if (!employeeId || !reviewerId) return;
    setSaving(true);
    await addReviewToCycle({ cycleId, employeeId, reviewerId, type });
    setSaving(false);
    setOpen(false);
    setEmployeeId("");
    setReviewerId("");
    setType("MANAGER");
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <UserPlus className="h-3.5 w-3.5" />Add Review
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add Review Assignment">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Employee Being Reviewed</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Reviewer</label>
            <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className={inputClass}>
              <option value="">Select reviewer...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Review Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReviewType)} className={inputClass}>
              <option value="SELF">Self Review</option>
              <option value="MANAGER">Manager Review</option>
              <option value="PEER">Peer Review</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={saving || !employeeId || !reviewerId}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Adding..." : "Add Review"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
