"use client";

import { cn } from "@/lib/utils";
import { Building2, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/actions/departments";
import { useRouter } from "next/navigation";

type Department = {
  id: string;
  name: string;
  description: string | null;
};

type Props = {
  departments: Department[];
};

export function DepartmentManager({ departments }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  function openAdd() {
    setName("");
    setDescription("");
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    setName("");
    setDescription("");
  }

  function openEdit(dept: Department) {
    setName(dept.name);
    setDescription(dept.description || "");
    setEditDept(dept);
  }

  function closeEdit() {
    setEditDept(null);
    setName("");
    setDescription("");
  }

  function openDelete(dept: Department) {
    setDeleteDept(dept);
  }

  function closeDelete() {
    setDeleteDept(null);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    await createDepartment({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setSaving(false);
    closeAdd();
    router.refresh();
  }

  async function handleUpdate() {
    if (!editDept || !name.trim()) return;
    setSaving(true);
    await updateDepartment(editDept.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setSaving(false);
    closeEdit();
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteDept) return;
    setDeleting(true);
    await deleteDepartment(deleteDept.id);
    setDeleting(false);
    closeDelete();
    router.refresh();
  }

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Departments
          </h2>
        </div>
        <button
          onClick={openAdd}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Department
        </button>
      </div>

      <div className="space-y-3">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "hover:bg-[var(--color-surface-hover)] transition-colors group"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {dept.name}
              </p>
              {dept.description && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                  {dept.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 ml-3 shrink-0">
              <button
                onClick={() => openEdit(dept)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => openDelete(dept)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
            No departments yet.
          </p>
        )}
      </div>

      {/* Add Department Dialog */}
      <Dialog open={showAdd} onClose={closeAdd} title="Add Department">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Brief description (optional)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={closeAdd}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50"
            )}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog
        open={!!editDept}
        onClose={closeEdit}
        title="Edit Department"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Brief description (optional)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={closeEdit}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!name.trim() || saving}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50"
            )}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteDept}
        onClose={closeDelete}
        title="Delete Department"
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Are you sure you want to delete{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            {deleteDept?.name}
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={closeDelete}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-red-600 text-white",
              "hover:bg-red-700",
              "disabled:opacity-50"
            )}
          >
            {deleting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
