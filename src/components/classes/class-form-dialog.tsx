"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { createRecruitmentClass, updateRecruitmentClass } from "@/lib/actions/recruitment-classes";
import { CLASS_STATUS_LABEL, type ClassStatus } from "@/lib/recruitment-classes/logic";
import type { ClassSummary } from "@/lib/recruitment-classes/types";
import { ghostButtonClass, inputClass, primaryButtonClass } from "./class-ui";

type PositionOption = { id: string; title: string; status: string };

type FormState = {
  name: string;
  role: string;
  positionId: string;
  startDate: string;
  targetCount: string;
  notes: string;
  status: ClassStatus;
};

function initialState(existing?: ClassSummary | null): FormState {
  return {
    name: existing?.name ?? "",
    role: existing?.role ?? "",
    positionId: existing?.positionId ?? "",
    startDate: existing?.startDate ?? "",
    targetCount: existing?.targetCount ? String(existing.targetCount) : "",
    notes: existing?.notes ?? "",
    status: existing?.status ?? "UPCOMING",
  };
}

export function ClassFormDialog({
  positions,
  existing,
  trigger,
}: {
  positions: PositionOption[];
  existing?: ClassSummary | null;
  /** Renders the button that opens the dialog. */
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => initialState(existing));

  function show() {
    setForm(initialState(existing));
    setError(null);
    setOpen(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPositionChange(id: string) {
    const pos = positions.find((p) => p.id === id);
    setForm((f) => ({ ...f, positionId: id, role: f.role.trim() ? f.role : pos?.title ?? f.role }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      role: form.role,
      positionId: form.positionId || null,
      startDate: form.startDate,
      targetCount: form.targetCount ? Number(form.targetCount) : null,
      notes: form.notes,
      status: form.status,
    };
    try {
      const res = existing ? await updateRecruitmentClass(existing.id, payload) : await createRecruitmentClass(payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (!existing && "id" in res) router.push(`/classes/${res.id}`);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the class.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = (form.role.trim() || form.positionId) && form.startDate && !saving;

  return (
    <>
      {trigger ? (
        trigger(show)
      ) : (
        <button onClick={show} className={primaryButtonClass}>
          <Icon name="add" size={16} />
          New class
        </button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={existing ? "Edit class" : "New class"}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Role *</label>
              <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Openers" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Start date *</label>
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Class name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Leave blank for “Role – Oct 12”" className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Linked position</label>
              <select value={form.positionId} onChange={(e) => onPositionChange(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.status !== "OPEN" ? ` (${p.status.toLowerCase()})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Target headcount</label>
              <input
                type="number"
                min={0}
                value={form.targetCount}
                onChange={(e) => set("targetCount", e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
          </div>
          {existing && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value as ClassStatus)} className={inputClass}>
                {(Object.keys(CLASS_STATUS_LABEL) as ClassStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {CLASS_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Started and cancelled classes move to Past classes.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={cn(inputClass, "resize-none")} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className={ghostButtonClass}>
            Cancel
          </button>
          <button onClick={save} disabled={!canSave} className={primaryButtonClass}>
            {saving ? "Saving..." : existing ? "Save" : "Create class"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
