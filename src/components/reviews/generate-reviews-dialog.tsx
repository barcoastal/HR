"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { generateReviewsForCycle } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Zap, Building2, Check } from "lucide-react";

type Department = { id: string; name: string; employeeCount: number };

export function GenerateReviewsDialog({
  cycleId,
  departments,
}: {
  cycleId: string;
  departments: Department[];
}) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; employees: number } | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const router = useRouter();

  function toggleDept(id: string) {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedDepts.size === departments.length) {
      setSelectedDepts(new Set());
    } else {
      setSelectedDepts(new Set(departments.map((d) => d.id)));
    }
  }

  async function handleGenerate() {
    if (selectedDepts.size === 0) return;
    setGenerating(true);
    try {
      const res = await generateReviewsForCycle(cycleId, Array.from(selectedDepts));
      setResult(res);
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    setSelectedDepts(new Set());
  }

  const totalEmployees = departments
    .filter((d) => selectedDepts.has(d.id))
    .reduce((acc, d) => acc + d.employeeCount, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-purple-400 hover:bg-purple-500/10 transition-colors"
        )}
      >
        <Zap className="h-3.5 w-3.5" />Generate
      </button>

      <Dialog open={open} onClose={handleClose} title="Generate Reviews">
        {result ? (
          <div className="text-center py-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Created {result.created} reviews
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              For {result.employees} employees (self + manager reviews)
            </p>
            <button
              onClick={handleClose}
              className={cn(
                "mt-4 px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
              )}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-muted)]">
                Select departments to auto-generate self-review and manager-review for each active employee.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  <Building2 className="h-3.5 w-3.5 inline mr-1" />
                  Departments
                </span>
                <button onClick={selectAll} className="text-xs text-[var(--color-accent)] hover:underline">
                  {selectedDepts.size === departments.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[var(--color-border)] p-2 bg-[var(--color-background)]">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => toggleDept(dept.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedDepts.has(dept.id)
                        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                        selectedDepts.has(dept.id)
                          ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                          : "border-[var(--color-border)]"
                      )}>
                        {selectedDepts.has(dept.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      {dept.name}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {dept.employeeCount} employee{dept.employeeCount !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
              {selectedDepts.size > 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Will create reviews for <span className="font-medium text-[var(--color-text-primary)]">{totalEmployees}</span> employees. Duplicates are skipped automatically.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={generating || selectedDepts.size === 0}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
              >
                {generating ? "Generating..." : "Generate Reviews"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
