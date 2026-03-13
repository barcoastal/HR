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
  ChevronDown,
  ChevronRight,
  FileText,
  Send,
  PenLine,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  dueDay: number | null;
  documentAction?: string | null;
  documentName?: string | null;
  assigneeName?: string | null;
  signingStatus?: string | null; // PENDING | VIEWED | SIGNED
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
  defaultExpanded?: boolean;
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

const PHASE_ORDER = [1, 2, 3, 5, 7, 14, 30, 60, 90];

function getDueDayLabel(dueDay: number | null): string {
  if (dueDay === null || dueDay === 0) return "Other";
  return DUE_DAY_LABELS[dueDay] || `Day ${dueDay}`;
}

function getPhaseKey(dueDay: number | null): string {
  if (dueDay === null || dueDay === 0) return "other";
  return String(dueDay);
}

/* ── Progress ring SVG ──────────────────────────────── */
function ProgressRing({ percent, size = 32 }: { percent: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={percent >= 100 ? "#10B981" : "var(--color-accent)"}
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

export function OnboardingTimeline({
  employee,
  tasks,
  availableItems,
  type,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const router = useRouter();

  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Group tasks by phase (dueDay)
  const phaseGroups: Record<string, TaskItem[]> = {};
  for (const task of tasks) {
    const key = getPhaseKey(task.dueDay);
    if (!phaseGroups[key]) phaseGroups[key] = [];
    phaseGroups[key].push(task);
  }

  // Sort phases: known order first, then "other"
  const sortedPhaseKeys = Object.keys(phaseGroups).sort((a, b) => {
    if (a === "other") return 1;
    if (b === "other") return -1;
    return Number(a) - Number(b);
  });

  function togglePhase(key: string) {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  const label = type === "ONBOARDING" ? "Onboarding" : "Offboarding";

  // Group available items by checklist name
  const groupedAvailable = availableItems.reduce<Record<string, AvailableChecklistItem[]>>((acc, item) => {
    if (!acc[item.checklistName]) acc[item.checklistName] = [];
    acc[item.checklistName].push(item);
    return acc;
  }, {});

  const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;
  const initials = employee.firstName[0] + employee.lastName[0];

  const inputClass = cn(
    "w-full px-3 py-2.5 rounded-xl text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-light)] focus:border-[var(--color-accent)]"
  );

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="gradient-border rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <PartyPopper className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
              {label} Complete!
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {employee.firstName} {employee.lastName} is now an active employee.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="gradient-border rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Employee Header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColors[colorIdx])}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {employee.jobTitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ProgressRing percent={progressPercent} size={36} />
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {doneCount}/{totalCount}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]">tasks</p>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-[var(--color-text-muted)] transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Expanded Timeline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-[var(--color-border)]">
              {/* Overall progress bar */}
              <div className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">Overall Progress</span>
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", allDone ? "bg-emerald-500" : "bg-gradient-to-r from-[var(--color-accent)] to-purple-500")}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Phase groups */}
              {tasks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                  No tasks assigned yet. Add tasks below.
                </p>
              ) : (
                <div className="relative ml-4 border-l-2 border-[var(--color-border)]">
                  {sortedPhaseKeys.map((phaseKey) => {
                    const phaseTasks = phaseGroups[phaseKey];
                    const phaseLabel = phaseKey === "other" ? "Other" : getDueDayLabel(Number(phaseKey));
                    const phaseDone = phaseTasks.filter((t) => t.status === "DONE").length;
                    const phaseTotal = phaseTasks.length;
                    const phasePercent = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                    const isCollapsed = collapsedPhases.has(phaseKey);

                    return (
                      <div key={phaseKey} className="relative pb-4 last:pb-0">
                        {/* Phase node */}
                        <div className="absolute -left-[9px] top-0">
                          <div className={cn(
                            "h-4 w-4 rounded-full border-2",
                            phaseDone === phaseTotal
                              ? "bg-emerald-500 border-emerald-500"
                              : "bg-[var(--color-surface)] border-[var(--color-accent)]"
                          )} />
                        </div>

                        {/* Phase header */}
                        <button
                          onClick={() => togglePhase(phaseKey)}
                          className="ml-5 flex items-center gap-3 w-full text-left group"
                        >
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{phaseLabel}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{phaseDone}/{phaseTotal} complete</span>
                          <ProgressRing percent={phasePercent} size={20} />
                          <ChevronRight className={cn("h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform ml-auto", !isCollapsed && "rotate-90")} />
                        </button>

                        {/* Phase tasks */}
                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-5 mt-2 space-y-1">
                                {phaseTasks.map((task) => {
                                  const isToggling = togglingIds.has(task.id);
                                  const isDone = task.status === "DONE";
                                  return (
                                    <motion.button
                                      key={task.id}
                                      layout
                                      onClick={() => handleToggleTask(task.id)}
                                      disabled={isToggling}
                                      className={cn(
                                        "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
                                        "hover:bg-[var(--color-surface-hover)]",
                                        "disabled:opacity-60"
                                      )}
                                    >
                                      <div className="mt-0.5 shrink-0">
                                        {isToggling ? (
                                          <Loader2 className="h-5 w-5 text-[var(--color-text-muted)] animate-spin" />
                                        ) : isDone ? (
                                          <motion.div
                                            initial={{ scale: 0.5 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                          >
                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                          </motion.div>
                                        ) : (
                                          <Circle className="h-5 w-5 text-[var(--color-text-muted)]" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className={cn(
                                          "text-sm font-medium",
                                          isDone ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
                                        )}>
                                          {task.title}
                                        </p>
                                        {task.description && (
                                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{task.description}</p>
                                        )}
                                        {isDone && task.completedAt && (
                                          <p className="text-xs text-emerald-500/70 mt-0.5">
                                            Completed {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                          </p>
                                        )}
                                        {/* Document status indicators */}
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                          {task.documentAction === "SEND" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-500">
                                              <Send className="h-3 w-3" />Sent
                                            </span>
                                          )}
                                          {task.documentAction === "SIGN" && (
                                            <span className={cn(
                                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                                              task.signingStatus === "SIGNED" ? "bg-emerald-500/10 text-emerald-500" :
                                              task.signingStatus === "VIEWED" ? "bg-blue-500/10 text-blue-500" :
                                              "bg-amber-500/10 text-amber-500"
                                            )}>
                                              <PenLine className="h-3 w-3" />
                                              {task.signingStatus === "SIGNED" ? "Signed" : task.signingStatus === "VIEWED" ? "Viewed" : "Pending Signature"}
                                            </span>
                                          )}
                                          {task.assigneeName && (
                                            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                              <UserCircle className="h-3 w-3" />Assigned to: {task.assigneeName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2",
                    "px-4 py-2.5 rounded-xl text-sm font-medium",
                    "bg-[var(--color-background)] border border-dashed border-[var(--color-border)]",
                    "text-[var(--color-text-muted)]",
                    "hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]",
                    "transition-colors"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add Tasks
                  {availableItems.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-semibold bg-[var(--color-accent)] text-white">
                      {availableItems.length}
                    </span>
                  )}
                </button>

                {type === "ONBOARDING" && allDone && (
                  <button
                    onClick={handleCompleteOnboarding}
                    disabled={completing}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2",
                      "px-4 py-2.5 rounded-xl text-sm font-medium",
                      "bg-emerald-500 text-white",
                      "hover:bg-emerald-600 transition-colors",
                      "disabled:opacity-50"
                    )}
                  >
                    {completing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Processing...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" />Complete {label}</>
                    )}
                  </button>
                )}
              </div>

              {/* Add Tasks Panel (slide-out inline) */}
              <AnimatePresence>
                {showAddPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Browse & Add Tasks</p>
                        <button
                          onClick={() => setShowAddPanel(false)}
                          className="text-xs text-[var(--color-accent)] hover:underline"
                        >
                          Close
                        </button>
                      </div>

                      {Object.keys(groupedAvailable).length === 0 ? (
                        <div className="text-center py-6">
                          <ClipboardList className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                          <p className="text-sm text-[var(--color-text-muted)]">All template tasks have been added.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                          {Object.entries(groupedAvailable).map(([checklistName, items]) => (
                            <div key={checklistName}>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">{checklistName}</p>
                              <div className="space-y-2">
                                {items.map((item) => {
                                  const isAdding = addingIds.has(item.id);
                                  const dueDayLabel = item.dueDay ? getDueDayLabel(item.dueDay) : null;
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        "flex items-start gap-3 p-3 rounded-xl transition-all",
                                        "bg-[var(--color-surface)] border border-[var(--color-border)]",
                                        "hover:border-[var(--color-accent)]/50",
                                        isAdding && "opacity-60"
                                      )}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                                        {item.description && (
                                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{item.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                          {item.assigneeName && (
                                            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                              <UserCircle className="h-3 w-3" />{item.assigneeName}
                                            </span>
                                          )}
                                          {dueDayLabel && (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                                              <Calendar className="h-3 w-3" />{dueDayLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleAddFromTemplate(item.id)}
                                        disabled={isAdding}
                                        className={cn(
                                          "shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                                          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                                          "disabled:opacity-50"
                                        )}
                                      >
                                        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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

                      {/* Custom task */}
                      <div className="border-t border-[var(--color-border)] pt-3 mt-3">
                        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Custom Task</label>
                        <input
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className={cn(inputClass, "mb-2")}
                          placeholder="Task title"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomTask(); } }}
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
                            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium",
                            "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                            "disabled:opacity-50"
                          )}
                        >
                          {addingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          {addingCustom ? "Adding..." : "Add Custom Task"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
