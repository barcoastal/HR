"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createReviewCycle, generateReviewsForCycle } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Plus, Building2, Check } from "lucide-react";

type Department = { id: string; name: string; employeeCount: number };

export function CreateCycleDialog({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

  async function handleCreate() {
    if (!form.name || !form.startDate || !form.endDate) return;
    setSaving(true);
    try {
      const cycle = await createReviewCycle(form);
      // Auto-generate reviews if departments selected
      if (selectedDepts.size > 0) {
        await generateReviewsForCycle(cycle.id, Array.from(selectedDepts));
      }
      setOpen(false);
      setForm({ name: "", startDate: "", endDate: "" });
      setSelectedDepts(new Set());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const totalEmployees = departments
    .filter((d) => selectedDepts.has(d.id))
    .reduce((acc, d) => acc + d.employeeCount, 0);

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
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        )}
      >
        <Plus className="h-4 w-4" />New Cycle
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create Review Cycle">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Cycle Name</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Q1 2026 Performance Review"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Department Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                <Building2 className="h-3.5 w-3.5 inline mr-1" />
                Auto-generate reviews for departments
              </label>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
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
              {departments.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">No departments found</p>
              )}
            </div>
            {selectedDepts.size > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                Will create self + manager reviews for <span className="font-medium text-[var(--color-text-primary)]">{totalEmployees}</span> employees across {selectedDepts.size} department{selectedDepts.size > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !form.name || !form.startDate || !form.endDate}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Creating..." : selectedDepts.size > 0 ? "Create & Generate Reviews" : "Create Cycle"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
