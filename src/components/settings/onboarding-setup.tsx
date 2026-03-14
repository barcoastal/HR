"use client";

import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Loader2,
  ClipboardList,
  Calendar,
  UserCircle,
  Paperclip,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  PenTool,
  Send,
  ShieldCheck,
  Briefcase,
  Eye,
} from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createChecklist,
  addChecklistItem,
  deleteChecklistItem,
  deleteChecklist,
  createOverrideChecklist,
  deleteOverrideChecklist,
  addExclusion,
  removeExclusion,
  getChecklistsForDepartment,
  getOverridesForDepartment,
} from "@/lib/actions/checklists";

type Employee = { id: string; firstName: string; lastName: string };
type Department = { id: string; name: string };
type JobTitle = { id: string; name: string };

type ChecklistItemData = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  assigneeId: string | null;
  assignee: { firstName: string; lastName: string } | null;
  dueDay: number | null;
  sendEmail: boolean;
  emailSubject: string | null;
  emailBody: string | null;
  documentUrl: string | null;
  documentName: string | null;
  documentAction: string;
};

type ChecklistData = {
  id: string;
  name: string;
  items: ChecklistItemData[];
};

type OverrideData = {
  id: string;
  name: string;
  jobTitle: { id: string; name: string } | null;
  items: ChecklistItemData[];
  exclusions: { id: string; excludedItemId: string; excludedItem: { id: string; title: string } }[];
};

const DUE_DAY_OPTIONS = [
  { value: 0, label: "No schedule" },
  { value: 1, label: "Day 1" },
  { value: 2, label: "Day 2" },
  { value: 3, label: "Day 3" },
  { value: 5, label: "Day 5" },
  { value: 7, label: "Week 1" },
  { value: 14, label: "Week 2" },
  { value: 30, label: "Month 1" },
  { value: 60, label: "Month 2" },
  { value: 90, label: "Month 3" },
];

const DOCUMENT_ACTIONS = [
  { value: "NONE", label: "None", icon: FileText },
  { value: "SEND", label: "Send", icon: Send },
  { value: "SIGN", label: "Sign", icon: PenTool },
];

function getDueDayLabel(dueDay: number | null): string {
  if (dueDay === null || dueDay === 0) return "No schedule";
  const option = DUE_DAY_OPTIONS.find((o) => o.value === dueDay);
  if (option) return option.label;
  return `Day ${dueDay}`;
}

function getDocActionBadge(action: string) {
  if (action === "SEND") return { label: "SEND", color: "bg-blue-500/10 text-blue-500" };
  if (action === "SIGN") return { label: "SIGN", color: "bg-purple-500/10 text-purple-500" };
  return null;
}

async function uploadDocument(file: File): Promise<{ url: string; name: string } | null> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch("/api/onboarding-docs/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function OnboardingSetup({
  departments,
  employees,
  jobTitles,
}: {
  departments: Department[];
  employees: Employee[];
  jobTitles: JobTitle[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Department selection
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");

  // Data
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [overrides, setOverrides] = useState<OverrideData[]>([]);
  const [loading, setLoading] = useState(false);

  // Add task form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newDueDay, setNewDueDay] = useState(0);
  const [newDocAction, setNewDocAction] = useState("NONE");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  // Override add form
  const [overrideJobTitleId, setOverrideJobTitleId] = useState("");
  const [creatingOverride, setCreatingOverride] = useState(false);

  // Override add-task forms (keyed by override id)
  const [overrideAddForms, setOverrideAddForms] = useState<Record<string, boolean>>({});
  const [overrideNewTitle, setOverrideNewTitle] = useState<Record<string, string>>({});
  const [overrideNewDesc, setOverrideNewDesc] = useState<Record<string, string>>({});
  const [overrideNewAssigneeId, setOverrideNewAssigneeId] = useState<Record<string, string>>({});
  const [overrideNewDueDay, setOverrideNewDueDay] = useState<Record<string, number>>({});
  const [overrideNewDocAction, setOverrideNewDocAction] = useState<Record<string, string>>({});
  const [overrideNewDocUrl, setOverrideNewDocUrl] = useState<Record<string, string>>({});
  const [overrideNewDocName, setOverrideNewDocName] = useState<Record<string, string>>({});
  const [overrideUploading, setOverrideUploading] = useState<Record<string, boolean>>({});
  const [overrideAddingItem, setOverrideAddingItem] = useState<Record<string, boolean>>({});

  // Creating checklist
  const [creatingChecklist, setCreatingChecklist] = useState(false);

  // Deleting
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

  // Exclusion toggling
  const [togglingExclusion, setTogglingExclusion] = useState<string | null>(null);

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const selectClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm appearance-none",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapChecklistItem(i: any): ChecklistItemData {
    return {
      id: i.id,
      title: i.title,
      description: i.description,
      order: i.order,
      assigneeId: i.assigneeId,
      assignee: i.assignee ? { firstName: i.assignee.firstName, lastName: i.assignee.lastName } : null,
      dueDay: i.dueDay,
      sendEmail: i.sendEmail,
      emailSubject: i.emailSubject,
      emailBody: i.emailBody,
      documentUrl: i.documentUrl,
      documentName: i.documentName,
      documentAction: i.documentAction ?? "NONE",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapChecklist(c: any): ChecklistData {
    return { id: c.id, name: c.name, items: (c.items ?? []).map(mapChecklistItem) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapOverride(o: any): OverrideData {
    return {
      id: o.id,
      name: o.name,
      jobTitle: o.jobTitle ? { id: o.jobTitle.id, name: o.jobTitle.name } : null,
      items: (o.items ?? []).map(mapChecklistItem),
      exclusions: (o.exclusions ?? []).map((e: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: e.id,
        excludedItemId: e.excludedItemId,
        excludedItem: { id: e.excludedItem.id, title: e.excludedItem.title },
      })),
    };
  }

  // Fetch data when department changes
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const deptId = selectedDeptId || null;
        const lists = await getChecklistsForDepartment(deptId);
        if (cancelled) return;
        setChecklists(lists.map(mapChecklist));

        if (selectedDeptId) {
          const ovr = await getOverridesForDepartment(selectedDeptId);
          if (cancelled) return;
          setOverrides(ovr.map(mapOverride));
        } else {
          setOverrides([]);
        }
      } catch (err) {
        console.error("Failed to fetch checklists:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [selectedDeptId]);

  // Refresh helper
  function refreshData() {
    startTransition(() => {
      router.refresh();
    });
    // Re-fetch local data
    const deptId = selectedDeptId || null;
    getChecklistsForDepartment(deptId).then((lists) => {
      setChecklists(lists.map(mapChecklist));
    });
    if (selectedDeptId) {
      getOverridesForDepartment(selectedDeptId).then((ovr) => {
        setOverrides(ovr.map(mapOverride));
      });
    }
  }

  // All base items from all checklists
  const allBaseItems = checklists.flatMap((c) => c.items);
  const baseChecklist = checklists[0] ?? null;

  // Dept name
  const selectedDeptName = selectedDeptId
    ? departments.find((d) => d.id === selectedDeptId)?.name ?? "Department"
    : "Global (All Departments)";

  // Existing override job title IDs
  const existingOverrideJobTitleIds = new Set(overrides.map((o) => o.jobTitle?.id).filter(Boolean));
  const availableJobTitlesForOverride = jobTitles.filter((jt) => !existingOverrideJobTitleIds.has(jt.id));

  // Create checklist
  async function handleCreateChecklist() {
    setCreatingChecklist(true);
    const name = selectedDeptId
      ? `${selectedDeptName} Onboarding`
      : "Global Onboarding";
    await createChecklist(name, "ONBOARDING", selectedDeptId || undefined);
    setCreatingChecklist(false);
    refreshData();
  }

  // Add task
  async function handleAddItem(checklistId: string) {
    if (!newTitle) return;
    setAddingItem(true);
    await addChecklistItem(
      checklistId,
      newTitle,
      newDesc || undefined,
      newAssigneeId || undefined,
      newDueDay || undefined,
      undefined, // sendEmail
      undefined, // emailSubject
      undefined, // emailBody
      newDocAction !== "NONE" ? newDocUrl || undefined : undefined,
      newDocAction !== "NONE" ? newDocName || undefined : undefined
    );
    setAddingItem(false);
    setNewTitle("");
    setNewDesc("");
    setNewAssigneeId("");
    setNewDueDay(0);
    setNewDocAction("NONE");
    setNewDocUrl("");
    setNewDocName("");
    setShowAddForm(false);
    refreshData();
  }

  // Handle file upload for new task
  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadDocument(file);
    if (result) {
      setNewDocUrl(result.url);
      setNewDocName(result.name);
    }
    setUploading(false);
    e.target.value = "";
  }

  // Delete task
  async function handleDeleteItem(itemId: string) {
    setDeletingItemId(itemId);
    await deleteChecklistItem(itemId);
    setDeletingItemId(null);
    refreshData();
  }

  // Create override
  async function handleCreateOverride() {
    if (!selectedDeptId || !overrideJobTitleId) return;
    setCreatingOverride(true);
    await createOverrideChecklist(selectedDeptId, overrideJobTitleId);
    setCreatingOverride(false);
    setOverrideJobTitleId("");
    refreshData();
  }

  // Delete override
  async function handleDeleteOverride(id: string) {
    setDeletingOverrideId(id);
    await deleteOverrideChecklist(id);
    setDeletingOverrideId(null);
    refreshData();
  }

  // Toggle exclusion
  async function handleToggleExclusion(overrideId: string, itemId: string, isExcluded: boolean) {
    setTogglingExclusion(`${overrideId}-${itemId}`);
    if (isExcluded) {
      await removeExclusion(overrideId, itemId);
    } else {
      await addExclusion(overrideId, itemId);
    }
    setTogglingExclusion(null);
    refreshData();
  }

  // Add task to override
  async function handleAddOverrideItem(overrideId: string, checklistId: string) {
    const title = overrideNewTitle[overrideId];
    if (!title) return;
    setOverrideAddingItem((prev) => ({ ...prev, [overrideId]: true }));
    await addChecklistItem(
      checklistId,
      title,
      overrideNewDesc[overrideId] || undefined,
      overrideNewAssigneeId[overrideId] || undefined,
      overrideNewDueDay[overrideId] || undefined,
      undefined,
      undefined,
      undefined,
      (overrideNewDocAction[overrideId] ?? "NONE") !== "NONE" ? overrideNewDocUrl[overrideId] || undefined : undefined,
      (overrideNewDocAction[overrideId] ?? "NONE") !== "NONE" ? overrideNewDocName[overrideId] || undefined : undefined
    );
    setOverrideAddingItem((prev) => ({ ...prev, [overrideId]: false }));
    setOverrideNewTitle((prev) => ({ ...prev, [overrideId]: "" }));
    setOverrideNewDesc((prev) => ({ ...prev, [overrideId]: "" }));
    setOverrideNewAssigneeId((prev) => ({ ...prev, [overrideId]: "" }));
    setOverrideNewDueDay((prev) => ({ ...prev, [overrideId]: 0 }));
    setOverrideNewDocAction((prev) => ({ ...prev, [overrideId]: "NONE" }));
    setOverrideNewDocUrl((prev) => ({ ...prev, [overrideId]: "" }));
    setOverrideNewDocName((prev) => ({ ...prev, [overrideId]: "" }));
    setOverrideAddForms((prev) => ({ ...prev, [overrideId]: false }));
    refreshData();
  }

  // Handle file upload for override task
  async function handleOverrideDocUpload(overrideId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOverrideUploading((prev) => ({ ...prev, [overrideId]: true }));
    const result = await uploadDocument(file);
    if (result) {
      setOverrideNewDocUrl((prev) => ({ ...prev, [overrideId]: result.url }));
      setOverrideNewDocName((prev) => ({ ...prev, [overrideId]: result.name }));
    }
    setOverrideUploading((prev) => ({ ...prev, [overrideId]: false }));
    e.target.value = "";
  }

  return (
    <section
      className={cn(
        "rounded-2xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <ClipboardList className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Onboarding Setup
        </h2>
      </div>

      {/* Department Selector */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Department
        </label>
        <select
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(e.target.value)}
          className={selectClass}
        >
          <option value="">Global (All Departments)</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
          <span className="ml-2 text-sm text-[var(--color-text-muted)]">Loading checklists...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Base Tasks Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
                Base Tasks
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  ({selectedDeptName})
                </span>
              </h3>
              {baseChecklist && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-[var(--color-accent)] text-white",
                    "hover:bg-[var(--color-accent-hover)] transition-colors"
                  )}
                >
                  {showAddForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showAddForm ? "Close" : "Add Task"}
                </button>
              )}
            </div>

            {/* No checklist - create button */}
            {checklists.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--color-text-muted)] mb-3">
                  No onboarding checklist for {selectedDeptName}. Create one to get started.
                </p>
                <button
                  onClick={handleCreateChecklist}
                  disabled={creatingChecklist}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-[var(--color-accent)] text-white",
                    "hover:bg-[var(--color-accent-hover)] transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  {creatingChecklist ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {creatingChecklist ? "Creating..." : "Create Onboarding Checklist"}
                </button>
              </div>
            )}

            {/* Task list */}
            {allBaseItems.length > 0 && (
              <div className="space-y-2">
                {allBaseItems.map((item) => {
                  const badge = getDocActionBadge(item.documentAction);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start justify-between p-3 rounded-lg",
                        "bg-[var(--color-background)] border border-[var(--color-border)]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate max-w-md">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.dueDay !== null && item.dueDay > 0 && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {getDueDayLabel(item.dueDay)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <UserCircle className="h-3 w-3" />
                            {item.assignee
                              ? `${item.assignee.firstName} ${item.assignee.lastName}`
                              : "Unassigned"}
                          </span>
                          {badge && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                badge.color
                              )}
                            >
                              {item.documentAction === "SEND" ? (
                                <Send className="h-3 w-3" />
                              ) : (
                                <PenTool className="h-3 w-3" />
                              )}
                              {badge.label}
                            </span>
                          )}
                          {item.documentName && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                "bg-amber-500/10 text-amber-600"
                              )}
                            >
                              <Paperclip className="h-3 w-3" />
                              {item.documentName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.documentUrl && item.documentAction !== "NONE" && (
                          <button
                            onClick={() => window.open(item.documentUrl!, "_blank")}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent)] transition-colors"
                            title={`Preview ${item.documentAction === "SIGN" ? "signing" : "send"} document`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingItemId === item.id}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                        >
                          {deletingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {baseChecklist && allBaseItems.length === 0 && (
              <p className="text-center text-xs text-[var(--color-text-muted)] py-4">
                No tasks yet. Add one to get started.
              </p>
            )}

            {/* Add task form (collapsible) */}
            {showAddForm && baseChecklist && (
              <div className="mt-3 p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">New Task</p>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Task title"
                />
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className={cn(inputClass, "resize-none")}
                  rows={2}
                  placeholder="Description (optional)"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      Due Day
                    </label>
                    <select
                      value={newDueDay}
                      onChange={(e) => setNewDueDay(Number(e.target.value))}
                      className={selectClass}
                    >
                      {DUE_DAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      <UserCircle className="inline h-3 w-3 mr-1" />
                      Assignee
                    </label>
                    <select
                      value={newAssigneeId}
                      onChange={(e) => setNewAssigneeId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      <FileText className="inline h-3 w-3 mr-1" />
                      Document Action
                    </label>
                    <select
                      value={newDocAction}
                      onChange={(e) => {
                        setNewDocAction(e.target.value);
                        if (e.target.value === "NONE") {
                          setNewDocUrl("");
                          setNewDocName("");
                        }
                      }}
                      className={selectClass}
                    >
                      {DOCUMENT_ACTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File upload when SEND or SIGN */}
                {newDocAction !== "NONE" && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      <Paperclip className="inline h-3 w-3 mr-1" />
                      Upload Document {newDocAction === "SIGN" && "(PDF only)"}
                    </label>
                    {newDocName ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
                          {newDocName}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setNewDocUrl(""); setNewDocName(""); }}
                          className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer w-fit",
                          "border border-dashed border-[var(--color-border)]",
                          "text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                        )}
                      >
                        {uploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        {uploading ? "Uploading..." : "Upload file"}
                        <input
                          type="file"
                          className="hidden"
                          accept={newDocAction === "SIGN" ? ".pdf" : ".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"}
                          onChange={handleDocUpload}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleAddItem(baseChecklist.id)}
                    disabled={!newTitle || addingItem}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                      "bg-[var(--color-accent)] text-white",
                      "hover:bg-[var(--color-accent-hover)] transition-colors",
                      "disabled:opacity-50"
                    )}
                  >
                    {addingItem ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {addingItem ? "Adding..." : "Add Task"}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Job Title Overrides Section (only for specific departments) */}
          {selectedDeptId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Job Title Overrides
                </h3>
              </div>

              {/* Add override */}
              {availableJobTitlesForOverride.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <select
                    value={overrideJobTitleId}
                    onChange={(e) => setOverrideJobTitleId(e.target.value)}
                    className={cn(selectClass, "max-w-xs")}
                  >
                    <option value="">Select job title...</option>
                    {availableJobTitlesForOverride.map((jt) => (
                      <option key={jt.id} value={jt.id}>
                        {jt.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateOverride}
                    disabled={!overrideJobTitleId || creatingOverride}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                      "bg-[var(--color-accent)] text-white",
                      "hover:bg-[var(--color-accent-hover)] transition-colors",
                      "disabled:opacity-50"
                    )}
                  >
                    {creatingOverride ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add Override
                  </button>
                </div>
              )}

              {/* Existing overrides */}
              {overrides.length === 0 && (
                <p className="text-center text-xs text-[var(--color-text-muted)] py-4">
                  No job title overrides yet. Add one to customize tasks for specific roles.
                </p>
              )}

              <div className="space-y-4">
                {overrides.map((override) => (
                  <div
                    key={override.id}
                    className={cn(
                      "rounded-xl p-4",
                      "bg-[var(--color-background)] border border-[var(--color-border)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                        {override.jobTitle?.name ?? "Unknown Role"}
                      </h4>
                      <button
                        onClick={() => handleDeleteOverride(override.id)}
                        disabled={deletingOverrideId === override.id}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                      >
                        {deletingOverrideId === override.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Excluded base tasks */}
                    {allBaseItems.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                          Base tasks (uncheck to exclude):
                        </p>
                        <div className="space-y-1">
                          {allBaseItems.map((item) => {
                            const isExcluded = override.exclusions.some(
                              (e) => e.excludedItemId === item.id
                            );
                            const isToggling = togglingExclusion === `${override.id}-${item.id}`;
                            return (
                              <label
                                key={item.id}
                                className={cn(
                                  "flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer text-xs",
                                  isExcluded
                                    ? "text-[var(--color-text-muted)] line-through opacity-60"
                                    : "text-[var(--color-text-primary)]",
                                  "hover:bg-[var(--color-surface-hover)] transition-colors"
                                )}
                              >
                                {isToggling ? (
                                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={!isExcluded}
                                    onChange={() =>
                                      handleToggleExclusion(override.id, item.id, isExcluded)
                                    }
                                    className="rounded border-[var(--color-border)] shrink-0"
                                  />
                                )}
                                {item.title}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Extra tasks for this override */}
                    {override.items.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                          Extra tasks:
                        </p>
                        <div className="space-y-1.5">
                          {override.items.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center justify-between py-1.5 px-2 rounded-lg",
                                "bg-[var(--color-surface)] border border-[var(--color-border)]"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[var(--color-text-primary)]">
                                  {item.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {item.dueDay !== null && item.dueDay > 0 && (
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                      {getDueDayLabel(item.dueDay)}
                                    </span>
                                  )}
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {item.assignee
                                      ? `${item.assignee.firstName} ${item.assignee.lastName}`
                                      : "Unassigned"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.documentUrl && item.documentAction !== "NONE" && (
                                  <button
                                    onClick={() => window.open(item.documentUrl!, "_blank")}
                                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                                    title={`Preview ${item.documentAction === "SIGN" ? "signing" : "send"} document`}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={deletingItemId === item.id}
                                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                                >
                                  {deletingItemId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add extra task form */}
                    {overrideAddForms[override.id] ? (
                      <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                          New Extra Task
                        </p>
                        <input
                          value={overrideNewTitle[override.id] ?? ""}
                          onChange={(e) =>
                            setOverrideNewTitle((prev) => ({ ...prev, [override.id]: e.target.value }))
                          }
                          className={inputClass}
                          placeholder="Task title"
                        />
                        <textarea
                          value={overrideNewDesc[override.id] ?? ""}
                          onChange={(e) =>
                            setOverrideNewDesc((prev) => ({ ...prev, [override.id]: e.target.value }))
                          }
                          className={cn(inputClass, "resize-none")}
                          rows={2}
                          placeholder="Description (optional)"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                              Due Day
                            </label>
                            <select
                              value={overrideNewDueDay[override.id] ?? 0}
                              onChange={(e) =>
                                setOverrideNewDueDay((prev) => ({
                                  ...prev,
                                  [override.id]: Number(e.target.value),
                                }))
                              }
                              className={selectClass}
                            >
                              {DUE_DAY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                              Assignee
                            </label>
                            <select
                              value={overrideNewAssigneeId[override.id] ?? ""}
                              onChange={(e) =>
                                setOverrideNewAssigneeId((prev) => ({
                                  ...prev,
                                  [override.id]: e.target.value,
                                }))
                              }
                              className={selectClass}
                            >
                              <option value="">Unassigned</option>
                              {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.firstName} {emp.lastName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                              Doc Action
                            </label>
                            <select
                              value={overrideNewDocAction[override.id] ?? "NONE"}
                              onChange={(e) => {
                                setOverrideNewDocAction((prev) => ({
                                  ...prev,
                                  [override.id]: e.target.value,
                                }));
                                if (e.target.value === "NONE") {
                                  setOverrideNewDocUrl((prev) => ({ ...prev, [override.id]: "" }));
                                  setOverrideNewDocName((prev) => ({ ...prev, [override.id]: "" }));
                                }
                              }}
                              className={selectClass}
                            >
                              {DOCUMENT_ACTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* File upload for override */}
                        {(overrideNewDocAction[override.id] ?? "NONE") !== "NONE" && (
                          <div>
                            {overrideNewDocName[override.id] ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
                                  {overrideNewDocName[override.id]}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverrideNewDocUrl((prev) => ({ ...prev, [override.id]: "" }));
                                    setOverrideNewDocName((prev) => ({ ...prev, [override.id]: "" }));
                                  }}
                                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <label
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer w-fit",
                                  "border border-dashed border-[var(--color-border)]",
                                  "text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                                )}
                              >
                                {overrideUploading[override.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                                {overrideUploading[override.id] ? "Uploading..." : "Upload file"}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept={
                                    overrideNewDocAction[override.id] === "SIGN"
                                      ? ".pdf"
                                      : ".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                                  }
                                  onChange={(e) => handleOverrideDocUpload(override.id, e)}
                                  disabled={!!overrideUploading[override.id]}
                                />
                              </label>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleAddOverrideItem(override.id, override.id)}
                            disabled={!overrideNewTitle[override.id] || !!overrideAddingItem[override.id]}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                              "bg-[var(--color-accent)] text-white",
                              "hover:bg-[var(--color-accent-hover)] transition-colors",
                              "disabled:opacity-50"
                            )}
                          >
                            {overrideAddingItem[override.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            {overrideAddingItem[override.id] ? "Adding..." : "Add Task"}
                          </button>
                          <button
                            onClick={() =>
                              setOverrideAddForms((prev) => ({ ...prev, [override.id]: false }))
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setOverrideAddForms((prev) => ({ ...prev, [override.id]: true }))
                        }
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                          "border border-dashed border-[var(--color-border)]",
                          "text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        Add Extra Task
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
