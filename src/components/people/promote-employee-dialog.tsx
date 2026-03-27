"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { promoteEmployee } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type Department = { id: string; name: string };

export function PromoteEmployeeDialog({
  employeeId,
  employeeName,
  currentJobTitle,
  currentDepartmentId,
  departments,
}: {
  employeeId: string;
  employeeName: string;
  currentJobTitle: string;
  currentDepartmentId: string | null;
  departments: Department[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState(
    currentDepartmentId || ""
  );
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newJobTitle.trim()) return;
    setSaving(true);
    try {
      await promoteEmployee(
        employeeId,
        newJobTitle.trim(),
        newDepartmentId || null
      );
      setOpen(false);
      setNewJobTitle("");
      router.refresh();
    } catch (err) {
      console.error("Failed to promote:", err);
    } finally {
      setSaving(false);
    }
  }

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
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
          "hover:bg-[var(--color-accent)]/20 transition-colors"
        )}
      >
        <Icon name="trending_up" size={16} />
        Promote
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Promote Employee">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Promote <span className="font-medium text-[var(--color-text-primary)]">{employeeName}</span> to a new position.
            This will update their profile and notify the team.
          </p>

          <div className={cn("rounded-lg p-3", "bg-[var(--color-surface-container)] border border-[var(--color-border)]")}>
            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Current Position</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {currentJobTitle}
              {currentDepartmentId && (
                <span className="text-[var(--color-text-muted)] font-normal">
                  {" "} · {departments.find((d) => d.id === currentDepartmentId)?.name}
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              New Job Title *
            </label>
            <input
              type="text"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className={inputClass}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Department
            </label>
            <select
              value={newDepartmentId}
              onChange={(e) => setNewDepartmentId(e.target.value)}
              className={inputClass}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-container)]",
                "transition-colors"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !newJobTitle.trim()}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent)]/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {saving ? "Promoting..." : "Promote"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
