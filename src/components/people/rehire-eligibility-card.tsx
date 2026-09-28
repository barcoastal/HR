"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRehireEligibility } from "@/lib/actions/employees";
import { parseRehireChoice } from "@/lib/rehire-eligibility";
import { RehireBadge } from "@/components/offboarding/former-employees-list";

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

function toChoice(eligible: boolean | null) {
  if (eligible === null) return "";
  return eligible ? "yes" : "no";
}

/** Rehire decision on a former employee's profile. Shown to HR and admins only. */
export function RehireEligibilityCard({
  employeeId,
  eligible,
  notes,
}: {
  employeeId: string;
  eligible: boolean | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(toChoice(eligible));
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = choice !== toChoice(eligible) || draftNotes.trim() !== (notes ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await setRehireEligibility(employeeId, parseRehireChoice(choice), draftNotes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Rehire</h3>
      <RehireBadge eligible={eligible} />

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={`rehire-${employeeId}`} className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Eligible for rehire?
          </label>
          <select
            id={`rehire-${employeeId}`}
            value={choice}
            disabled={saving}
            onChange={(event) => setChoice(event.target.value)}
            className={inputClass}
          >
            <option value="">Not decided yet</option>
            <option value="yes">Yes, eligible for rehire</option>
            <option value="no">No, not eligible for rehire</option>
          </select>
        </div>
        <div>
          <label htmlFor={`rehire-notes-${employeeId}`} className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Notes
          </label>
          <textarea
            id={`rehire-notes-${employeeId}`}
            value={draftNotes}
            disabled={saving}
            onChange={(event) => setDraftNotes(event.target.value)}
            rows={3}
            placeholder="Optional. Visible to HR and admins only."
            className={cn(inputClass, "resize-none")}
          />
        </div>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !changed}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}
