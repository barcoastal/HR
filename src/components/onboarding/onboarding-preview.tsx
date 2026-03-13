"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { resolveOnboardingTasks } from "@/lib/actions/onboarding-resolution";
import { Dialog } from "@/components/ui/dialog";
import { Loader2, FileText, PenLine, Send, X, ClipboardList } from "lucide-react";

type ResolvedTask = {
  checklistItemId: string;
  title: string;
  description: string | null;
  order: number;
  dueDay: number | null;
  assigneeId: string | null;
  documentAction: string;
  documentUrl: string | null;
  documentName: string | null;
  sendEmail: boolean;
  emailSubject: string | null;
  emailBody: string | null;
};

const DUE_DAY_LABELS: Record<number, string> = {
  1: "Day 1", 2: "Day 2", 3: "Day 3", 5: "Day 5",
  7: "Week 1", 14: "Week 2", 30: "Month 1", 60: "Month 2", 90: "Month 3",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  departmentId: string | null;
  jobTitle: string;
  departmentName: string;
  loading: boolean;
};

export function OnboardingPreview({ open, onClose, onConfirm, departmentId, jobTitle, departmentName, loading }: Props) {
  const [tasks, setTasks] = useState<ResolvedTask[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      setFetching(true);
      setExcluded(new Set());
      resolveOnboardingTasks(departmentId, jobTitle).then((resolved) => {
        setTasks(resolved);
        setFetching(false);
      });
    }
  }, [open, departmentId, jobTitle]);

  const visibleTasks = tasks.filter((t) => !excluded.has(t.checklistItemId));

  const toggleExclude = (itemId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Onboarding Preview">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Preview onboarding tasks for <strong>{jobTitle}</strong> in <strong>{departmentName || "Global"}</strong>.
          You can remove tasks before confirming.
        </p>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No onboarding tasks configured for {departmentName || "this department"}.
              You can add custom tasks or configure templates in Settings.
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {tasks.map((task) => {
              const isExcluded = excluded.has(task.checklistItemId);
              return (
                <div
                  key={task.checklistItemId}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all",
                    isExcluded
                      ? "opacity-40 bg-[var(--color-background)] border-[var(--color-border)]"
                      : "bg-[var(--color-surface)] border-[var(--color-border)]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", isExcluded ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {task.dueDay && task.dueDay > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                          {DUE_DAY_LABELS[task.dueDay] || `Day ${task.dueDay}`}
                        </span>
                      )}
                      {task.documentAction === "SEND" && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                          <Send className="h-3 w-3" />Send Doc
                        </span>
                      )}
                      {task.documentAction === "SIGN" && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <PenLine className="h-3 w-3" />Sign Doc
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExclude(task.checklistItemId)}
                    className="shrink-0 p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                    title={isExcluded ? "Restore task" : "Remove task"}
                  >
                    {isExcluded ? (
                      <span className="text-xs text-[var(--color-accent)]">Restore</span>
                    ) : (
                      <X className="h-4 w-4 text-[var(--color-text-muted)]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            {visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""} will be created
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || fetching}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50"
              )}
            >
              {loading ? "Creating..." : "Confirm & Start Onboarding"}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
