"use client";

import { cn } from "@/lib/utils";
import { Cable, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  createRecruitmentPlatform,
  updateRecruitmentPlatform,
  deleteRecruitmentPlatform,
} from "@/lib/actions/recruitment-platforms";
import { useRouter } from "next/navigation";

type Platform = {
  id: string;
  name: string;
  accountIdentifier: string | null;
  type: "PREMIUM" | "NICHE" | "SOCIAL" | "JOB_BOARD";
  monthlyCost: number;
  status: "ACTIVE" | "PAUSED" | "DISCONNECTED";
  notes: string | null;
};

type Props = {
  platforms: Platform[];
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PREMIUM: { label: "Premium", color: "bg-purple-500/15 text-purple-400" },
  NICHE: { label: "Niche", color: "bg-blue-500/15 text-blue-400" },
  SOCIAL: { label: "Social", color: "bg-pink-500/15 text-pink-400" },
  JOB_BOARD: { label: "Job Board", color: "bg-amber-500/15 text-amber-400" },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-400",
  PAUSED: "bg-amber-400",
  DISCONNECTED: "bg-red-400",
};

export function PlatformIntegrationManager({ platforms }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editPlatform, setEditPlatform] = useState<Platform | null>(null);
  const [deletePlatformState, setDeletePlatform] = useState<Platform | null>(null);

  const [name, setName] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [type, setType] = useState<Platform["type"]>("JOB_BOARD");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [status, setStatus] = useState<Platform["status"]>("ACTIVE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  function resetForm() {
    setName("");
    setAccountIdentifier("");
    setType("JOB_BOARD");
    setMonthlyCost("");
    setStatus("ACTIVE");
    setNotes("");
  }

  function openAdd() {
    resetForm();
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    resetForm();
  }

  function openEdit(p: Platform) {
    setName(p.name);
    setAccountIdentifier(p.accountIdentifier || "");
    setType(p.type);
    setMonthlyCost(String(p.monthlyCost));
    setStatus(p.status);
    setNotes(p.notes || "");
    setEditPlatform(p);
  }

  function closeEdit() {
    setEditPlatform(null);
    resetForm();
  }

  function openDelete(p: Platform) {
    setDeletePlatform(p);
  }

  function closeDelete() {
    setDeletePlatform(null);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    await createRecruitmentPlatform({
      name: name.trim(),
      accountIdentifier: accountIdentifier.trim() || undefined,
      type,
      monthlyCost: parseFloat(monthlyCost) || 0,
      status,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    closeAdd();
    router.refresh();
  }

  async function handleUpdate() {
    if (!editPlatform || !name.trim()) return;
    setSaving(true);
    await updateRecruitmentPlatform(editPlatform.id, {
      name: name.trim(),
      accountIdentifier: accountIdentifier.trim() || undefined,
      type,
      monthlyCost: parseFloat(monthlyCost) || 0,
      status,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    closeEdit();
    router.refresh();
  }

  async function handleDelete() {
    if (!deletePlatformState) return;
    setDeleting(true);
    await deleteRecruitmentPlatform(deletePlatformState.id);
    setDeleting(false);
    closeDelete();
    router.refresh();
  }

  const formFields = (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Platform Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g. LinkedIn Recruiter"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Account Identifier
        </label>
        <input
          value={accountIdentifier}
          onChange={(e) => setAccountIdentifier(e.target.value)}
          className={inputClass}
          placeholder="e.g. company-account-id"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Platform["type"])}
            className={inputClass}
          >
            <option value="PREMIUM">Premium</option>
            <option value="NICHE">Niche</option>
            <option value="SOCIAL">Social</option>
            <option value="JOB_BOARD">Job Board</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Monthly Cost ($)
          </label>
          <input
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(e.target.value)}
            type="number"
            className={inputClass}
            placeholder="0"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Platform["status"])}
          className={inputClass}
        >
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="DISCONNECTED">Disconnected</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={cn(inputClass, "resize-none")}
          placeholder="Optional notes..."
        />
      </div>
    </div>
  );

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Cable className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Platform Integrations
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
          Add Platform
        </button>
      </div>

      <div className="space-y-3">
        {platforms.map((p) => {
          const typeInfo = TYPE_LABELS[p.type] || TYPE_LABELS.JOB_BOARD;
          const statusColor = STATUS_COLORS[p.status] || STATUS_COLORS.DISCONNECTED;
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "hover:bg-[var(--color-surface-hover)] transition-colors group"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusColor)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {p.name}
                    </p>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", typeInfo.color)}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.accountIdentifier && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {p.accountIdentifier}
                      </p>
                    )}
                    <p className="text-xs font-medium text-[var(--color-text-primary)]">
                      ${p.monthlyCost}/mo
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3 shrink-0">
                <button
                  onClick={() => openEdit(p)}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openDelete(p)}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {platforms.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
            No recruitment platforms registered yet.
          </p>
        )}
      </div>

      {/* Add Platform Dialog */}
      <Dialog open={showAdd} onClose={closeAdd} title="Add Platform">
        {formFields}
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

      {/* Edit Platform Dialog */}
      <Dialog
        open={!!editPlatform}
        onClose={closeEdit}
        title="Edit Platform"
      >
        {formFields}
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
        open={!!deletePlatformState}
        onClose={closeDelete}
        title="Delete Platform"
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Are you sure you want to delete{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            {deletePlatformState?.name}
          </span>
          ? This will also remove all cost history. This action cannot be undone.
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
