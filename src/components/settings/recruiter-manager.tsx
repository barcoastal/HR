"use client";

import { cn } from "@/lib/utils";
import { UserCheck, X, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { updateRecruiters } from "@/lib/actions/company-settings";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
};

type Props = {
  recruiters: Employee[];
  allEmployees: Employee[];
};

export function RecruiterManager({ recruiters, allEmployees }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(recruiters.map((r) => r.id))
  );
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const hasChanges =
    selectedIds.size !== recruiters.length ||
    recruiters.some((r) => !selectedIds.has(r.id));

  async function handleSave() {
    setSaving(true);
    await updateRecruiters(Array.from(selectedIds));
    setSaving(false);
    router.refresh();
  }

  function addRecruiter(id: string) {
    setSelectedIds((prev) => new Set([...prev, id]));
    setShowPicker(false);
    setSearch("");
  }

  function removeRecruiter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const selectedEmployees = allEmployees.filter((e) => selectedIds.has(e.id));
  const availableEmployees = allEmployees
    .filter((e) => !selectedIds.has(e.id))
    .filter(
      (e) =>
        !search ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Recruiters
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Designated recruiters are assigned to candidates when they enter the pipeline
            </p>
          </div>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)] transition-colors",
              "disabled:opacity-50"
            )}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {selectedEmployees.map((emp) => (
          <div
            key={emp.id}
            className={cn(
              "flex items-center justify-between px-4 py-3 rounded-lg",
              "bg-[var(--color-background)] border border-[var(--color-border)]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center text-xs font-semibold text-[var(--color-accent)]">
                {emp.firstName[0]}
                {emp.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {emp.firstName} {emp.lastName}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {emp.jobTitle || emp.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeRecruiter(emp.id)}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {selectedEmployees.length === 0 && !showPicker && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
            No recruiters assigned yet. Add employees as recruiters.
          </p>
        )}

        {showPicker ? (
          <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-background)]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              autoFocus
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm mb-2",
                "bg-[var(--color-surface)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              )}
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => addRecruiter(emp.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                    "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  )}
                >
                  <div className="h-7 w-7 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[10px] font-semibold text-[var(--color-accent)]">
                    {emp.firstName[0]}
                    {emp.lastName[0]}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {emp.jobTitle || emp.email}
                    </p>
                  </div>
                </button>
              ))}
              {availableEmployees.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                  No more employees to add
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setShowPicker(false);
                setSearch("");
              }}
              className="w-full mt-2 px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
              "border border-dashed border-[var(--color-border)]",
              "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
            )}
          >
            <Plus className="h-4 w-4" />
            Add Recruiter
          </button>
        )}
      </div>
    </section>
  );
}
