"use client";

import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ClipboardList,
  Pencil,
  Check,
  X,
  Calendar,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  createChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  deleteChecklist,
} from "@/lib/actions/checklists";
import { useRouter } from "next/navigation";

type ChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  requiresDocument: boolean;
  order: number;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDay: number | null;
};

type Checklist = {
  id: string;
  name: string;
  type: "ONBOARDING" | "OFFBOARDING";
  items: ChecklistItem[];
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
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

function getDueDayLabel(dueDay: number | null): string {
  if (dueDay === null || dueDay === 0) return "No schedule";
  const option = DUE_DAY_OPTIONS.find((o) => o.value === dueDay);
  if (option) return option.label;
  return `Day ${dueDay}`;
}

export function ChecklistManager({
  checklists,
  employees,
}: {
  checklists: Checklist[];
  employees: Employee[];
}) {
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(
    null
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"ONBOARDING" | "OFFBOARDING">(
    "ONBOARDING"
  );
  const [creating, setCreating] = useState(false);

  // Add item state
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAssigneeId, setNewItemAssigneeId] = useState("");
  const [newItemDueDay, setNewItemDueDay] = useState(0);
  const [addingItem, setAddingItem] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDay, setEditDueDay] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const router = useRouter();

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

  async function handleCreateChecklist() {
    if (!newName) return;
    setCreating(true);
    await createChecklist(newName, newType);
    setCreating(false);
    setShowCreate(false);
    setNewName("");
    router.refresh();
  }

  async function handleAddItem() {
    if (!selectedChecklist || !newItemTitle) return;
    setAddingItem(true);
    await addChecklistItem(
      selectedChecklist.id,
      newItemTitle,
      newItemDesc || undefined,
      newItemAssigneeId || undefined,
      newItemDueDay || undefined
    );
    setAddingItem(false);
    setNewItemTitle("");
    setNewItemDesc("");
    setNewItemAssigneeId("");
    setNewItemDueDay(0);
    router.refresh();
  }

  async function handleDeleteItem(itemId: string) {
    setDeletingId(itemId);
    await deleteChecklistItem(itemId);
    setDeletingId(null);
    if (editingItemId === itemId) {
      setEditingItemId(null);
    }
    router.refresh();
  }

  async function handleDeleteChecklist(id: string) {
    await deleteChecklist(id);
    setSelectedChecklist(null);
    router.refresh();
  }

  function startEditing(item: ChecklistItem) {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.description || "");
    setEditAssigneeId(item.assigneeId || "");
    setEditDueDay(item.dueDay || 0);
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDesc("");
    setEditAssigneeId("");
    setEditDueDay(0);
  }

  async function handleSaveEdit() {
    if (!editingItemId || !editTitle) return;
    setSavingEdit(true);
    await updateChecklistItem(editingItemId, {
      title: editTitle,
      description: editDesc || undefined,
      assigneeId: editAssigneeId || undefined,
      dueDay: editDueDay || undefined,
    });
    setSavingEdit(false);
    setEditingItemId(null);
    router.refresh();
  }

  // Find updated checklist from props after refresh
  const currentChecklist = selectedChecklist
    ? checklists.find((c) => c.id === selectedChecklist.id) || null
    : null;

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Checklist Templates
          </h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Checklist
        </button>
      </div>

      <div className="space-y-3">
        {checklists.map((template) => (
          <div
            key={template.id}
            onClick={() => setSelectedChecklist(template)}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg cursor-pointer",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "hover:bg-[var(--color-surface-hover)] transition-colors group"
            )}
          >
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {template.name}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {template.items.length} items · {template.type}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteChecklist(template.id);
              }}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {checklists.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
            No checklists yet. Create one to define onboarding or offboarding
            steps.
          </p>
        )}
      </div>

      {/* Create Checklist Dialog */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Checklist"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Name *
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              placeholder="e.g. New Hire Onboarding"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Type *
            </label>
            <select
              value={newType}
              onChange={(e) =>
                setNewType(e.target.value as "ONBOARDING" | "OFFBOARDING")
              }
              className={inputClass}
            >
              <option value="ONBOARDING">Onboarding</option>
              <option value="OFFBOARDING">Offboarding</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => setShowCreate(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateChecklist}
            disabled={!newName || creating}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50"
            )}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </Dialog>

      {/* Edit Checklist Items Dialog */}
      <Dialog
        open={!!currentChecklist}
        onClose={() => {
          setSelectedChecklist(null);
          cancelEditing();
        }}
        title={currentChecklist ? `${currentChecklist.name} — Steps` : ""}
      >
        {currentChecklist && (
          <>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
              {currentChecklist.items
                .sort((a, b) => a.order - b.order)
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3 rounded-lg",
                      "bg-[var(--color-background)] border border-[var(--color-border)]"
                    )}
                  >
                    {editingItemId === item.id ? (
                      /* Inline editing mode */
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                            Title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={inputClass}
                            placeholder="Step title"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                            Description
                          </label>
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className={cn(inputClass, "resize-none")}
                            rows={2}
                            placeholder="Description (optional)"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                              <UserCircle className="inline h-3 w-3 mr-1" />
                              Assignee
                            </label>
                            <select
                              value={editAssigneeId}
                              onChange={(e) =>
                                setEditAssigneeId(e.target.value)
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
                              <Calendar className="inline h-3 w-3 mr-1" />
                              Due Day
                            </label>
                            <select
                              value={editDueDay}
                              onChange={(e) =>
                                setEditDueDay(Number(e.target.value))
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
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={!editTitle || savingEdit}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                              "bg-[var(--color-accent)] text-white",
                              "hover:bg-[var(--color-accent-hover)] transition-colors",
                              "disabled:opacity-50"
                            )}
                          >
                            {savingEdit ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={savingEdit}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            <span className="text-xs text-[var(--color-text-muted)] mr-1.5">
                              {idx + 1}.
                            </span>
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                              <UserCircle className="h-3 w-3" />
                              {item.assigneeName || "Unassigned"}
                            </span>
                            {item.dueDay !== null && item.dueDay > 0 && (
                              <span
                                className={cn(
                                  "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                                  "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                )}
                              >
                                <Calendar className="h-3 w-3 mr-1" />
                                {getDueDayLabel(item.dueDay)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditing(item)}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {currentChecklist.items.length === 0 && (
                <p className="text-center text-xs text-[var(--color-text-muted)] py-4">
                  No steps yet. Add one below.
                </p>
              )}
            </div>

            {/* Add new item */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                Add Step
              </p>
              <input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className={inputClass}
                placeholder="Step title, e.g. Set up email account"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                className={inputClass}
                placeholder="Description (optional)"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    <UserCircle className="inline h-3 w-3 mr-1" />
                    Assignee
                  </label>
                  <select
                    value={newItemAssigneeId}
                    onChange={(e) => setNewItemAssigneeId(e.target.value)}
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
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Due Day
                  </label>
                  <select
                    value={newItemDueDay}
                    onChange={(e) => setNewItemDueDay(Number(e.target.value))}
                    className={selectClass}
                  >
                    {DUE_DAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddItem}
                disabled={!newItemTitle || addingItem}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                  "bg-[var(--color-accent)] text-white",
                  "hover:bg-[var(--color-accent-hover)]",
                  "disabled:opacity-50"
                )}
              >
                {addingItem ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    Add Step
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
