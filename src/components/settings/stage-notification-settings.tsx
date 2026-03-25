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

export function StageNotificationSettings({ initialRecipients }: { initialRecipients: StageNotifyRecipient[] }) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<StageNotifyRecipient[]>(initialRecipients);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(value: StageNotifyRecipient) {
    setRecipients((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveStageNotifyRecipients(recipients);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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

      <div className="space-y-3 mb-5">
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
