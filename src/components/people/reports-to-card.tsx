"use client";

import { cn, getInitials, displayFirstName, displayName } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeManager } from "@/lib/actions/employees";
import { Icon } from "@/components/ui/icon";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  jobTitle: string;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

/**
 * "Reports To" on a person's profile. Admin/HR can assign, change or remove
 * the manager here, including for someone who has none yet.
 */
export function ReportsToCard({
  employeeId,
  manager,
  canEdit,
  candidates,
}: {
  employeeId: string;
  manager: Person | null;
  canEdit: boolean;
  /** People who can be picked as the manager. Only needed when canEdit. */
  candidates: Person[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The choice being saved; cleared when it is rejected so the saved manager shows again.
  const [chosen, setChosen] = useState<string | null>(null);

  async function handleChange(managerId: string | null) {
    setSaving(true);
    setError(null);
    setChosen(managerId ?? "");
    try {
      const result = await setEmployeeManager(employeeId, managerId);
      if (!result.ok) {
        setError(result.error);
        setChosen(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save the manager. Please try again.");
      setChosen(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Reports To</h3>
      {manager ? (
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[displayFirstName(manager).charCodeAt(0) % avatarColors.length])}>
            {getInitials(displayFirstName(manager), manager.lastName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{displayName(manager)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{manager.jobTitle}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">No manager assigned</p>
      )}

      {canEdit && (
        <div className="mt-4">
          <label htmlFor={`manager-${employeeId}`} className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            {manager ? "Change manager" : "Assign manager"}
          </label>
          <div className="flex items-center gap-2">
            <select
              id={`manager-${employeeId}`}
              value={chosen ?? manager?.id ?? ""}
              disabled={saving}
              onChange={(event) => handleChange(event.target.value || null)}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
                saving && "opacity-50"
              )}
            >
              <option value="">No manager</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)} · {person.jobTitle}
                </option>
              ))}
            </select>
            {saving && <Icon name="progress_activity" size={16} className="animate-material-spin shrink-0 text-[var(--color-accent)]" />}
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </section>
  );
}
