"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createReviewCycle, generateReviewsForCycle } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { TemplateBuilder } from "@/components/reviews/template-builder";
import { getDefaultTemplate } from "@/lib/review-templates";
import type { TemplateField } from "@/lib/review-templates";

type Department = { id: string; name: string; employeeCount: number };

export function CreateCycleDialog({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TemplateField[]>(getDefaultTemplate());
  const [showTypeOverrides, setShowTypeOverrides] = useState(false);
  const [selfTemplate, setSelfTemplate] = useState<TemplateField[]>([]);
  const [managerTemplate, setManagerTemplate] = useState<TemplateField[]>([]);
  const [peerTemplate, setPeerTemplate] = useState<TemplateField[]>([]);
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
      const cycle = await createReviewCycle({
        ...form,
        template: template.length > 0 ? template : undefined,
        selfTemplate: selfTemplate.length > 0 ? selfTemplate : undefined,
        managerTemplate: managerTemplate.length > 0 ? managerTemplate : undefined,
        peerTemplate: peerTemplate.length > 0 ? peerTemplate : undefined,
      });
      // Auto-generate reviews if departments selected
      if (selectedDepts.size > 0) {
        await generateReviewsForCycle(cycle.id, Array.from(selectedDepts));
      }
      setOpen(false);
      setForm({ name: "", startDate: "", endDate: "" });
      setSelectedDepts(new Set());
      setTemplate(getDefaultTemplate());
      setShowTypeOverrides(false);
      setSelfTemplate([]);
      setManagerTemplate([]);
      setPeerTemplate([]);
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
        <Icon name="add" size={16} />New Cycle
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

          {/* Review Form Template */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">
              <Icon name="dynamic_form" size={12} className="inline mr-1" />
              Review Form Fields
            </label>
            <TemplateBuilder value={template} onChange={setTemplate} />

            {/* Per-type overrides */}
            <button
              onClick={() => setShowTypeOverrides(!showTypeOverrides)}
              className="mt-3 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
            >
              <Icon name={showTypeOverrides ? "expand_less" : "expand_more"} size={14} />
              Customize by review type
            </button>
            {showTypeOverrides && (
              <div className="mt-3 space-y-4 border-t border-[var(--color-border)]/50 pt-3">
                {([
                  { label: "Self Review", value: selfTemplate, onChange: setSelfTemplate },
                  { label: "Manager Review", value: managerTemplate, onChange: setManagerTemplate },
                  { label: "Peer Review", value: peerTemplate, onChange: setPeerTemplate },
                ] as const).map(({ label, value: tpl, onChange: setTpl }) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                      {label} {tpl.length === 0 && <span className="text-[var(--color-text-muted)] font-normal">(uses default)</span>}
                    </p>
                    <TemplateBuilder value={tpl} onChange={setTpl} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Department Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                <Icon name="business" size={12} className="inline mr-1" />
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
                      {selectedDepts.has(dept.id) && <Icon name="check" size={12} className="text-white" />}
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
