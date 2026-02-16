"use client";

import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/actions/departments";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
};

type DeptInfo = {
  id: string;
  name: string;
  description: string | null;
  headId?: string | null;
  head: { firstName: string; lastName: string } | null;
  teams: string[];
  memberCount: number;
};

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const inputClassName = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
);

const accentButtonClassName = cn(
  "px-4 py-2 rounded-lg text-sm font-medium",
  "bg-[var(--color-accent)] text-white",
  "hover:bg-[var(--color-accent-hover)] transition-colors",
  "disabled:opacity-50"
);

const cancelButtonClassName =
  "px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors";

const destructiveButtonClassName = cn(
  "px-4 py-2 rounded-lg text-sm font-medium",
  "bg-red-600 text-white",
  "hover:bg-red-700 transition-colors",
  "disabled:opacity-50"
);

const labelClassName =
  "block text-sm font-medium text-[var(--color-text-primary)] mb-1.5";

// ---------------------------------------------------------------------------
// EmployeeSelect – reusable dropdown for choosing a department head
// ---------------------------------------------------------------------------

function EmployeeSelect({
  employees,
  value,
  onChange,
}: {
  employees: Employee[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      <option value="">No department head</option>
      {employees.map((emp) => (
        <option key={emp.id} value={emp.id}>
          {emp.firstName} {emp.lastName} — {emp.jobTitle}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// DepartmentActions – "Add Department" button + create dialog
// ---------------------------------------------------------------------------

export function DepartmentActions({
  departments: _,
  employees = [],
}: {
  departments: DeptInfo[];
  employees?: Employee[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headId, setHeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function resetForm() {
    setName("");
    setDescription("");
    setHeadId("");
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createDepartment({
        name: name.trim(),
        description: description.trim() || undefined,
        headId: headId || undefined,
      });
      resetForm();
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)] text-white",
          "hover:bg-[var(--color-accent-hover)] transition-colors",
          "shadow-[0_0_12px_var(--color-accent-glow)]"
        )}
      >
        <Plus className="h-4 w-4" />
        Add Department
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add Department"
      >
        <div className="space-y-4">
          <div>
            <label className={labelClassName}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Department name"
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              rows={3}
              className={cn(inputClassName, "resize-none")}
            />
          </div>

          <div>
            <label className={labelClassName}>Department Head</label>
            <EmployeeSelect
              employees={employees}
              value={headId}
              onChange={setHeadId}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOpen(false)}
              className={cancelButtonClassName}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || loading}
              className={accentButtonClassName}
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// EditDepartmentDialog – standalone dialog for editing an existing department
// ---------------------------------------------------------------------------

export function EditDepartmentDialog({
  department,
  employees = [],
  open,
  onClose,
}: {
  department: DeptInfo;
  employees?: Employee[];
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(
    department.description ?? ""
  );
  const [headId, setHeadId] = useState(department.headId ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateDepartment(department.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        headId: headId || null,
      });
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit Department">
      <div className="space-y-4">
        <div>
          <label className={labelClassName}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Department name"
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description"
            rows={3}
            className={cn(inputClassName, "resize-none")}
          />
        </div>

        <div>
          <label className={labelClassName}>Department Head</label>
          <EmployeeSelect
            employees={employees}
            value={headId}
            onChange={setHeadId}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={cancelButtonClassName}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || loading}
            className={accentButtonClassName}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DeleteDepartmentDialog – confirmation dialog for deleting a department
// ---------------------------------------------------------------------------

export function DeleteDepartmentDialog({
  department,
  open,
  onClose,
}: {
  department: DeptInfo;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteDepartment(department.id);
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Delete Department">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {department.name}
          </span>
          ? This action cannot be undone.
          {department.memberCount > 0 && (
            <>
              {" "}
              This department currently has{" "}
              <span className="font-semibold">
                {department.memberCount}
              </span>{" "}
              member{department.memberCount === 1 ? "" : "s"}.
            </>
          )}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={cancelButtonClassName}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className={destructiveButtonClassName}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DepartmentRowActions – inline edit / delete buttons for a table row
// ---------------------------------------------------------------------------

export function DepartmentRowActions({
  department,
  employees = [],
}: {
  department: DeptInfo;
  employees?: Employee[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditOpen(true)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            "hover:bg-[var(--color-surface-hover)]"
          )}
          aria-label={`Edit ${department.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => setDeleteOpen(true)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-[var(--color-text-muted)] hover:text-red-500",
            "hover:bg-[var(--color-surface-hover)]"
          )}
          aria-label={`Delete ${department.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <EditDepartmentDialog
        department={department}
        employees={employees}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <DeleteDepartmentDialog
        department={department}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
