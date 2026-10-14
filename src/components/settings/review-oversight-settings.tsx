"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { saveReviewOversightSettings } from "@/lib/actions/notification-settings";

type Employee = { id: string; firstName: string; lastName: string; email: string };
type Department = { id: string; name: string };

export function ReviewOversightSettings({
  initial,
  allEmployees,
  departments,
}: {
  initial: { enabled: boolean; recipientIds: string[]; departmentIds: string[] };
  allEmployees: Employee[];
  departments: Department[];
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [recipientIds, setRecipientIds] = useState<string[]>(initial.recipientIds);
  const [departmentIds, setDepartmentIds] = useState<string[]>(initial.departmentIds);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const query = search.trim().toLowerCase();
  const suggestions = query
    ? allEmployees.filter((e) => !recipientIds.includes(e.id) && (`${e.firstName} ${e.lastName}`.toLowerCase().includes(query) || e.email.toLowerCase().includes(query))).slice(0, 6)
    : [];

  function changed() {
    setStatus(null);
  }

  function toggleDepartment(id: string) {
    setDepartmentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    changed();
  }

  async function save() {
    setSaving(true);
    const result = await saveReviewOversightSettings({ enabled, recipientIds, departmentIds });
    setSaving(false);
    setStatus(result.success ? { ok: true, text: "Saved" } : { ok: false, text: result.error || "Could not save" });
  }

  return (
    <div className={cn("mt-6 rounded-2xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Review &amp; 1:1 oversight alerts</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            The people below get an email and an in-app notification when a 1:1 is scheduled or completed, and a week before each
            30-, 60- and 90-day, quarterly and yearly review is due, for employees in the chosen departments. They can also see those
            review dates on the Calendar. Managers are always reminded about their own reports.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); changed(); }} className="h-4 w-4 accent-[var(--color-accent)]" />
          Alerts on
        </label>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-[var(--color-text-primary)]">Who gets the alerts</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {recipientIds.length === 0 && <span className="text-xs italic text-[var(--color-text-muted)]">Nobody yet</span>}
          {recipientIds.map((id) => {
            const employee = allEmployees.find((e) => e.id === id);
            if (!employee) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)]/10 px-2 py-1 text-xs text-[var(--color-accent)]">
                {employee.firstName} {employee.lastName}
                <button type="button" aria-label={`Remove ${employee.firstName} ${employee.lastName}`} onClick={() => { setRecipientIds((prev) => prev.filter((x) => x !== id)); changed(); }} className="hover:text-red-500">
                  <Icon name="close" size={12} />
                </button>
              </span>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people to add…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        {suggestions.length > 0 && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
            {suggestions.map((e) => (
              <button key={e.id} type="button" onClick={() => { setRecipientIds((prev) => [...prev, e.id]); setSearch(""); changed(); }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--color-surface-hover)]">
                {e.firstName} {e.lastName} <span className="text-[var(--color-text-muted)]">({e.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-1 text-xs font-medium text-[var(--color-text-primary)]">Which departments</p>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">{departmentIds.length === 0 ? "All departments. Pick one or more to narrow it, for example Closers." : `${departmentIds.length} selected`}</p>
        <div className="flex flex-wrap gap-1.5">
          {departments.map((department) => {
            const on = departmentIds.includes(department.id);
            return (
              <button
                key={department.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDepartment(department.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {department.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {status && <span className={cn("text-xs", status.ok ? "text-emerald-700" : "text-red-700")}>{status.text}</span>}
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
          {saving ? "Saving..." : "Save oversight alerts"}
        </button>
      </div>
    </div>
  );
}
