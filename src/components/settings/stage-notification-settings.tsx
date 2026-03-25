"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStageNotifyRecipients } from "@/lib/actions/company-settings";
import type { StageNotifyRecipient } from "@/lib/actions/company-settings";
import { Icon } from "@/components/ui/icon";

const OPTIONS: { value: StageNotifyRecipient; label: string; description: string }[] = [
  { value: "candidate", label: "Candidate", description: "The candidate whose stage changed" },
  { value: "recruiter", label: "Recruiter", description: "The recruiter assigned to the candidate" },
  { value: "manager", label: "Manager", description: "The hiring manager assigned to the candidate" },
];

type Employee = { id: string; firstName: string; lastName: string; email: string };

export function StageNotificationSettings({
  initialRecipients,
  initialEmployeeIds,
  allEmployees,
}: {
  initialRecipients: StageNotifyRecipient[];
  initialEmployeeIds: string[];
  allEmployees: Employee[];
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<StageNotifyRecipient[]>(initialRecipients);
  const [employeeIds, setEmployeeIds] = useState<string[]>(initialEmployeeIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");

  function toggle(value: StageNotifyRecipient) {
    setRecipients((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
    setSaved(false);
  }

  function addEmployee(id: string) {
    setEmployeeIds((prev) => [...prev, id]);
    setShowPicker(false);
    setSearch("");
    setSaved(false);
  }

  function removeEmployee(id: string) {
    setEmployeeIds((prev) => prev.filter((eid) => eid !== id));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveStageNotifyRecipients(recipients, employeeIds);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const selectedEmployees = allEmployees.filter((e) => employeeIds.includes(e.id));
  const availableEmployees = allEmployees
    .filter((e) => !employeeIds.includes(e.id))
    .filter(
      (e) =>
        !search ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <section className="rounded-xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="notifications" size={20} className="text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Stage Change Notifications</h2>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Choose who receives an email notification when a candidate moves to a new pipeline stage.
      </p>

      <div className="space-y-3 mb-6">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={recipients.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{opt.label}</span>
              <p className="text-xs text-[var(--color-text-muted)]">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Additional HR team members */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Additional Recipients</h3>
            <p className="text-xs text-[var(--color-text-muted)]">HR team members who always get notified on every stage change</p>
          </div>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            + Add Person
          </button>
        </div>

        {showPicker && (
          <div className="mb-3 border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-surface)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] mb-2"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableEmployees.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] py-2 text-center">No employees found</p>
              )}
              {availableEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => addEmployee(e.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <span className="text-[var(--color-text-primary)] font-medium">{e.firstName} {e.lastName}</span>
                  <span className="text-[var(--color-text-muted)] ml-2 text-xs">{e.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedEmployees.length > 0 ? (
          <div className="space-y-2">
            {selectedEmployees.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{e.firstName} {e.lastName}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">{e.email}</span>
                </div>
                <button
                  onClick={() => removeEmployee(e.id)}
                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] italic">No additional recipients configured</p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save"}
      </button>
    </section>
  );
}
