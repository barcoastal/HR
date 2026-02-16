"use client";

import { cn } from "@/lib/utils";
import { UserMinus, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { startOffboarding } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: { name: string } | null;
};

function defaultEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

export function StartOffboardingDialog({ employees }: { employees: Employee[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [success, setSuccess] = useState<{ name: string; taskCount: number } | null>(null);
  const router = useRouter();

  async function handleSubmit() {
    if (!selectedId || !endDate) return;
    setLoading(true);
    const result = await startOffboarding(selectedId, endDate);
    setSuccess({
      name: `${result.employee.firstName} ${result.employee.lastName}`,
      taskCount: result.taskCount,
    });
    setLoading(false);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setSelectedId("");
    setEndDate(defaultEndDate);
    setSuccess(null);
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
          "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
          "bg-orange-500 text-white",
          "hover:bg-orange-600 transition-colors"
        )}
      >
        <UserMinus className="h-4 w-4" />Start Offboarding
      </button>

      <Dialog open={open} onClose={handleClose} title="Start Offboarding">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-14 w-14 rounded-full bg-orange-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-orange-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">Offboarding Started</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {success.name} has been moved to offboarding with {success.taskCount} task{success.taskCount !== 1 ? "s" : ""} assigned.
              </p>
            </div>
            <button
              onClick={handleClose}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]")}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Employee *</label>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} — {e.jobTitle}{e.department ? ` · ${e.department.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Last Working Day *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedId || !endDate || loading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-orange-500 text-white",
                  "hover:bg-orange-600",
                  "disabled:opacity-50"
                )}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Processing...</> : "Start Offboarding"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
