"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Plus,
  Loader2,
  PartyPopper,
  ClipboardList,
  Calendar,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  toggleEmployeeTask,
  addEmployeeTask,
  addCustomEmployeeTask,
  completeOnboarding,
} from "@/lib/actions/employees";
import { useRouter } from "next/navigation";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "DONE";
  completedAt: string | null;
};

type AvailableChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  checklistName: string;
  assigneeName: string | null;
  dueDay: number | null;
};

type Props = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  tasks: TaskItem[];
  availableItems: AvailableChecklistItem[];
  type: "ONBOARDING" | "OFFBOARDING";
};

const DUE_DAY_LABELS: Record<number, string> = {
  1: "Day 1",
  2: "Day 2",
  3: "Day 3",
  5: "Day 5",
  7: "Week 1",
  14: "Week 2",
  30: "Month 1",
  60: "Month 2",
  90: "Month 3",
};

function getDueDayLabel(dueDay: number | null): string | null {
  if (dueDay === null || dueDay === 0) return null;
  return DUE_DAY_LABELS[dueDay] || `Day ${dueDay}`;
}

export function OnboardingTaskManager({
  employee,
  tasks,
  availableItems,
  type,
}: Props) {
  const [open, setOpen] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const router = useRouter();

  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const accentButtonClass = cn(
    "px-4 py-2 rounded-lg text-sm font-medium",
    "bg-[var(--color-accent)] text-white",
    "hover:bg-[var(--color-accent-hover)]",
    "disabled:opacity-50"
  );

  async function handleToggleTask(taskId: string) {
    setTogglingIds((prev) => new Set(prev).add(taskId));
    await toggleEmployeeTask(taskId);
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    router.refresh();
  }

  async function handleAddFromTemplate(checklistItemId: string) {
    setAddingIds((prev) => new Set(prev).add(checklistItemId));
    await addEmployeeTask(employee.id, checklistItemId);
    setAddingIds((prev) => {
      const next = new Set(prev);
      next.delete(checklistItemId);
      return next;
    });
    router.refresh();
  }

  async function handleAddCustomTask() {
    if (!customTitle.trim()) return;
    setAddingCustom(true);
    await addCustomEmployeeTask(employee.id, customTitle.trim(), customDesc.trim() || undefined, type);
    setCustomTitle("");
    setCustomDesc("");
    setAddingCustom(false);
    router.refresh();
  }

  async function handleCompleteOnboarding() {
    setCompleting(true);
    await completeOnboarding(employee.id);
    setCompleting(false);
    setCompleted(true);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    setCompleted(false);
    setShowTaskPicker(false);
  }

  const label = type === "ONBOARDING" ? "Onboarding" : "Offboarding";

  // Group available items by checklist name
  const groupedItems = availableItems.reduce<Record<string, AvailableChecklistItem[]>>((acc, item) => {
    if (!acc[item.checklistName]) acc[item.checklistName] = [];
    acc[item.checklistName].push(item);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-full text-left p-4 rounded-xl transition-colors",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {employee.jobTitle}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {doneCount}/{totalCount} tasks
            </p>
            <div className="mt-1 w-20 h-1.5 rounded-full bg-[var(--color-border)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  allDone
                    ? "bg-emerald-500"
                    : "bg-[var(--color-accent)]"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={`${label} Tasks — ${employee.firstName} ${employee.lastName}`}
      >
        {completed ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <PartyPopper className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                Onboarding Complete!
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {employee.firstName} {employee.lastName} is now an active
                employee.
              </p>
            </div>
            <button onClick={handleClose} className={accentButtonClass}>
              Done
            </button>
          </div>
        ) : showTaskPicker ? (
          /* Task Picker View — visual cards from Settings templates */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Choose from Template Tasks
              </p>
              <button
                onClick={() => setShowTaskPicker(false)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Back to tasks
              </button>
            </div>

            {Object.keys(groupedItems).length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">
                  All template tasks have been added, or no templates exist yet.
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Create checklist templates in Settings to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {Object.entries(groupedItems).map(([checklistName, items]) => (
                  <div key={checklistName}>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      {checklistName}
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const isAdding = addingIds.has(item.id);
                        const dueDayLabel = getDueDayLabel(item.dueDay);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg transition-all",
                              "bg-[var(--color-background)] border border-[var(--color-border)]",
                              "hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)]",
                              isAdding && "opacity-60"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {item.assigneeName && (
                                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                    <UserCircle className="h-3 w-3" />
                                    {item.assigneeName}
                                  </span>
                                )}
                                {dueDayLabel && (
                                  <span className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
                                    "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                  )}>
                                    <Calendar className="h-3 w-3" />
                                    {dueDayLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddFromTemplate(item.id)}
                              disabled={isAdding}
                              className={cn(
                                "shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                "bg-[var(--color-accent)] text-white",
                                "hover:bg-[var(--color-accent-hover)]",
                                "disabled:opacity-50"
                              )}
                            >
                              {isAdding ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              {isAdding ? "Adding..." : "Add"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom task section within picker */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                Or Add a Custom Task
              </label>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className={cn(inputClass, "mb-2")}
                placeholder="Task title, e.g. Set up email account"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTask();
                  }
                }}
              />
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                className={cn(inputClass, "mb-2")}
                placeholder="Description (optional)"
              />
              <button
                onClick={handleAddCustomTask}
                disabled={!customTitle.trim() || addingCustom}
                className={cn(
                  "flex items-center gap-1.5 shrink-0",
                  accentButtonClass
                )}
              >
                {addingCustom ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {addingCustom ? "Adding..." : "Add Custom Task"}
              </button>
            </div>
          </div>
        ) : (
          /* Main task list view */
          <div className="space-y-5">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  Progress
                </span>
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  {doneCount} of {totalCount} complete
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-border)]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    allDone ? "bg-emerald-500" : "bg-[var(--color-accent)]"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Task list */}
            <div className="space-y-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                  No tasks assigned yet. Add tasks from the templates below.
                </p>
              ) : (
                tasks.map((task) => {
                  const isToggling = togglingIds.has(task.id);
                  const isDone = task.status === "DONE";
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleToggleTask(task.id)}
                      disabled={isToggling}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                        "hover:bg-[var(--color-surface-hover)]",
                        "disabled:opacity-60"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isToggling ? (
                          <Loader2 className="h-5 w-5 text-[var(--color-text-muted)] animate-spin" />
                        ) : isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-[var(--color-text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isDone
                              ? "text-[var(--color-text-muted)] line-through"
                              : "text-[var(--color-text-primary)]"
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {isDone && task.completedAt && (
                          <p className="text-xs text-emerald-500/70 mt-0.5">
                            Completed{" "}
                            {new Date(task.completedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Add Tasks button — opens task picker */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <button
                onClick={() => setShowTaskPicker(true)}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "px-4 py-2.5 rounded-lg text-sm font-medium",
                  "bg-[var(--color-background)] border border-dashed border-[var(--color-border)]",
                  "text-[var(--color-text-muted)]",
                  "hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]",
                  "transition-colors"
                )}
              >
                <ClipboardList className="h-4 w-4" />
                Browse & Add Tasks
                {availableItems.length > 0 && (
                  <span className={cn(
                    "ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-semibold",
                    "bg-[var(--color-accent)] text-white"
                  )}>
                    {availableItems.length}
                  </span>
                )}
              </button>
            </div>

            {/* Complete Onboarding button */}
            {type === "ONBOARDING" && allDone && (
              <div className="border-t border-[var(--color-border)] pt-4">
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={completing}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "px-4 py-2.5 rounded-lg text-sm font-medium",
                    "bg-emerald-500 text-white",
                    "hover:bg-emerald-600 transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  {completing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <PartyPopper className="h-4 w-4" />
                      Complete Onboarding
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
