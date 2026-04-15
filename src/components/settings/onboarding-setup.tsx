"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import {
  createChecklist,
  addChecklistItem,
  updateChecklistItem,
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
  { value: "NONE", label: "None" },
  { value: "SEND", label: "Send" },
  { value: "SIGN", label: "Sign" },
  { value: "FILL", label: "Fill" },
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
  if (action === "FILL") return { label: "FILL", color: "bg-teal-500/10 text-teal-500" };
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
  checklistType = "ONBOARDING",
}: {
  departments: Department[];
  employees: Employee[];
  jobTitles: JobTitle[];
  checklistType?: "PRE_ONBOARDING" | "ONBOARDING";
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
        const lists = await getChecklistsForDepartment(deptId, checklistType);
        if (cancelled) return;
        setChecklists(lists.map(mapChecklist));

        if (selectedDeptId) {
          const ovr = await getOverridesForDepartment(selectedDeptId, checklistType);
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
  }, [selectedDeptId, checklistType]);

  // Refresh helper
  function refreshData() {
    startTransition(() => {
      router.refresh();
    });
    // Re-fetch local data
    const deptId = selectedDeptId || null;
    getChecklistsForDepartment(deptId, checklistType).then((lists) => {
      setChecklists(lists.map(mapChecklist));
    });
    if (selectedDeptId) {
      getOverridesForDepartment(selectedDeptId, checklistType).then((ovr) => {
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
    const typeLabel = checklistType === "PRE_ONBOARDING" ? "Pre-Onboarding" : "Onboarding";
    const name = selectedDeptId
      ? `${selectedDeptName} ${typeLabel}`
      : `Global ${typeLabel}`;
    await createChecklist(name, checklistType, selectedDeptId || undefined);
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
      newDocAction !== "NONE" ? newDocName || undefined : undefined,
      newDocAction
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
    await createOverrideChecklist(selectedDeptId, overrideJobTitleId, checklistType);
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
      (overrideNewDocAction[overrideId] ?? "NONE") !== "NONE" ? overrideNewDocName[overrideId] || undefined : undefined,
      overrideNewDocAction[overrideId] || "NONE"
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
        <Icon name="assignment" size={20} className="text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {checklistType === "PRE_ONBOARDING" ? "Pre-Onboarding Setup" : "Onboarding Setup"}
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
          <Icon name="progress_activity" size={20} className="animate-material-spin text-[var(--color-accent)]" />
          <span className="ml-2 text-sm text-[var(--color-text-muted)]">Loading checklists...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Base Tasks Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Icon name="verified_user" size={16} className="text-[var(--color-accent)]" />
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
                  {showAddForm ? <Icon name="expand_less" size={12} /> : <Icon name="add" size={12} />}
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
                    <Icon name="progress_activity" size={16} className="animate-material-spin" />
                  ) : (
                    <Icon name="add" size={16} />
                  )}
                  {creatingChecklist ? "Creating..." : "Create Onboarding Checklist"}
                </button>
              </div>
            )}

            {/* Task list */}
            {allBaseItems.length > 0 && (
              <div className="space-y-2">
                {allBaseItems.map((item) => {
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
                              <Icon name="calendar_today" size={12} />
                              {getDueDayLabel(item.dueDay)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Icon name="account_circle" size={12} />
                            {item.assignee
                              ? `${item.assignee.firstName} ${item.assignee.lastName}`
                              : "Unassigned"}
                          </span>
                          <select
                            value={item.documentAction}
                            onChange={async (e) => {
                              const newAction = e.target.value;
                              await updateChecklistItem(item.id, { documentAction: newAction });
                              router.refresh();
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none pr-5 bg-no-repeat bg-[length:12px] bg-[right_4px_center]",
                              item.documentAction === "SEND" ? "bg-blue-500/10 text-blue-500" :
                              item.documentAction === "SIGN" ? "bg-purple-500/10 text-purple-500" :
                              item.documentAction === "FILL" ? "bg-teal-500/10 text-teal-500" :
                              "bg-gray-100 text-gray-500"
                            )}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")` }}
                          >
                            {DOCUMENT_ACTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {(item.documentAction === "SIGN" || item.documentAction === "FILL") && (
                            <select
                              value={(item as unknown as { documentRecipient?: string }).documentRecipient || "EMPLOYEE"}
                              onChange={async (e) => {
                                await updateChecklistItem(item.id, { documentRecipient: e.target.value as "EMPLOYEE" | "ASSIGNEE" });
                                router.refresh();
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none pr-5 bg-no-repeat bg-[length:12px] bg-[right_4px_center]",
                                "bg-indigo-500/10 text-indigo-600"
                              )}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")` }}
                              title="Who receives this document"
                            >
                              <option value="EMPLOYEE">→ New hire</option>
                              <option value="ASSIGNEE">→ Assignee</option>
                            </select>
                          )}
                          {item.documentName && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                "bg-amber-500/10 text-amber-600"
                              )}
                            >
                              <Icon name="attach_file" size={12} />
                              {item.documentName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.documentUrl && item.documentAction !== "NONE" && (
                          <button
                            onClick={() => {
                              if (item.documentAction === "SIGN") {
                                window.open(`/sign/test?doc=${encodeURIComponent(item.documentUrl!)}&name=${encodeURIComponent(item.documentName || "Document")}`, "_blank");
                              } else if (item.documentAction === "FILL") {
                                window.open(`/fill/test?doc=${encodeURIComponent(item.documentUrl!)}&name=${encodeURIComponent(item.documentName || "Document")}`, "_blank");
                              } else {
                                window.open(item.documentUrl!, "_blank");
                              }
                            }}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent)] transition-colors"
                            title={item.documentAction === "SIGN" ? "Test signing flow" : item.documentAction === "FILL" ? "Test fill flow" : "Preview document"}
                          >
                            <Icon name="visibility" size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingItemId === item.id}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                        >
                          {deletingItemId === item.id ? (
                            <Icon name="progress_activity" size={12} className="animate-material-spin" />
                          ) : (
                            <Icon name="delete" size={12} />
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
                      <Icon name="calendar_today" size={12} className="inline mr-1" />
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
                      <Icon name="account_circle" size={12} className="inline mr-1" />
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
                      <Icon name="description" size={12} className="inline mr-1" />
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
                      <Icon name="attach_file" size={12} className="inline mr-1" />
                      Upload Document {(newDocAction === "SIGN" || newDocAction === "FILL") && "(PDF only)"}
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
                          <Icon name="close" size={12} />
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
                          <Icon name="progress_activity" size={12} className="animate-material-spin" />
                        ) : (
                          <Icon name="upload" size={12} />
                        )}
                        {uploading ? "Uploading..." : "Upload file"}
                        <input
                          type="file"
                          className="hidden"
                          accept={newDocAction === "SIGN" || newDocAction === "FILL" ? ".pdf" : ".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"}
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
                      <Icon name="progress_activity" size={12} className="animate-material-spin" />
                    ) : (
                      <Icon name="add" size={12} />
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
                <Icon name="work" size={16} className="text-[var(--color-accent)]" />
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
                      <Icon name="progress_activity" size={12} className="animate-material-spin" />
                    ) : (
                      <Icon name="add" size={12} />
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
                        <Icon name="work" size={12} className="text-[var(--color-accent)]" />
                        {override.jobTitle?.name ?? "Unknown Role"}
                      </h4>
                      <button
                        onClick={() => handleDeleteOverride(override.id)}
                        disabled={deletingOverrideId === override.id}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                      >
                        {deletingOverrideId === override.id ? (
                          <Icon name="progress_activity" size={12} className="animate-material-spin" />
                        ) : (
                          <Icon name="delete" size={12} />
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
                                  <Icon name="progress_activity" size={12} className="animate-material-spin shrink-0" />
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
                                    onClick={() => {
                                      if (item.documentAction === "SIGN") {
                                        window.open(`/sign/test?doc=${encodeURIComponent(item.documentUrl!)}&name=${encodeURIComponent(item.documentName || "Document")}`, "_blank");
                                      } else if (item.documentAction === "FILL") {
                                        window.open(`/fill/test?doc=${encodeURIComponent(item.documentUrl!)}&name=${encodeURIComponent(item.documentName || "Document")}`, "_blank");
                                      } else {
                                        window.open(item.documentUrl!, "_blank");
                                      }
                                    }}
                                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                                    title={item.documentAction === "SIGN" ? "Test signing flow" : item.documentAction === "FILL" ? "Test fill flow" : "Preview document"}
                                  >
                                    <Icon name="visibility" size={12} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={deletingItemId === item.id}
                                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                                >
                                  {deletingItemId === item.id ? (
                                    <Icon name="progress_activity" size={12} className="animate-material-spin" />
                                  ) : (
                                    <Icon name="delete" size={12} />
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
                                  <Icon name="close" size={12} />
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
                                  <Icon name="progress_activity" size={12} className="animate-material-spin" />
                                ) : (
                                  <Icon name="upload" size={12} />
                                )}
                                {overrideUploading[override.id] ? "Uploading..." : "Upload file"}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept={
                                    overrideNewDocAction[override.id] === "SIGN" || overrideNewDocAction[override.id] === "FILL"
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
                              <Icon name="progress_activity" size={12} className="animate-material-spin" />
                            ) : (
                              <Icon name="add" size={12} />
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
                        <Icon name="add" size={12} />
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
