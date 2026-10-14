"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useEffect, useState } from "react";
import {
  REJECTION_REASONS,
  REJECTION_NOTE_MAX_LENGTH,
  REJECTION_REASONS_REQUIRING_NOTE,
  rejectionReasonLabel,
  validateRejection,
  type RejectionInput,
  type RejectionReasonCode,
} from "@/lib/candidate-rejection";

const fieldClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

export type RejectionValue = { reason: string; note: string };

/** Reason picker + note. `optional` adds a "no reason" choice (used by Do Not Call). */
export function RejectionReasonFields({
  value,
  onChange,
  optional = false,
  idPrefix = "rejection",
}: {
  value: RejectionValue;
  onChange: (value: RejectionValue) => void;
  optional?: boolean;
  idPrefix?: string;
}) {
  const noteRequired = REJECTION_REASONS_REQUIRING_NOTE.includes(value.reason as RejectionReasonCode);
  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={`${idPrefix}-reason`} className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
          Rejection reason{optional ? " (optional)" : ""}
        </label>
        <select
          id={`${idPrefix}-reason`}
          value={value.reason}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
          className={fieldClass}
        >
          <option value="">{optional ? "No standard reason" : "Choose a reason…"}</option>
          {REJECTION_REASONS.map((r) => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
      </div>
      {value.reason && (
        <div>
          <label htmlFor={`${idPrefix}-note`} className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Note{noteRequired ? " (required)" : " (optional)"}
          </label>
          <textarea
            id={`${idPrefix}-note`}
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            rows={2}
            maxLength={REJECTION_NOTE_MAX_LENGTH}
            placeholder={noteRequired ? "Briefly explain the reason" : "Anything the team should know"}
            className={fieldClass}
          />
        </div>
      )}
    </div>
  );
}

/** Small red tag showing a rejected candidate's disposition. */
export function RejectionReasonTag({
  reason,
  note,
  className,
}: {
  reason: string | null | undefined;
  note?: string | null;
  className?: string;
}) {
  const label = rejectionReasonLabel(reason);
  if (!label) return null;
  return (
    <span
      title={note ? `Rejected: ${label} — ${note}` : `Rejected: ${label}`}
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0",
        "bg-red-500/10 text-red-600",
        className
      )}
    >
      <Icon name="block" size={10} />
      {label}
    </span>
  );
}

/**
 * Modal that asks for a rejection reason before a move to Rejected. The
 * confirm handler may throw or return an error string; either is shown.
 */
export function RejectionReasonDialog({
  open,
  candidateName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  candidateName?: string;
  onCancel: () => void;
  onConfirm: (rejection: RejectionInput) => Promise<string | void> | string | void;
}) {
  const [value, setValue] = useState<RejectionValue>({ reason: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue({ reason: "", note: "" });
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const check = validateRejection(value);

  async function submit() {
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm({ reason: check.value.reason, note: check.value.note });
      if (typeof result === "string" && result) setError(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this candidate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onCancel} title="Reject candidate">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Why is{" "}
          <span className="font-medium text-[var(--color-text-primary)]">{candidateName || "this candidate"}</span>{" "}
          being rejected? The reason is saved on their record and can be filtered and exported.
        </p>
        <RejectionReasonFields value={value} onChange={setValue} idPrefix="reject-dialog" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !check.ok}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Replaces the old window.prompt for Do Not Call: free-text reason plus an optional standard disposition. */
export function DoNotCallDialog({
  open,
  candidateName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  candidateName?: string;
  onCancel: () => void;
  onConfirm: (reason: string, disposition: RejectionInput | null) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<RejectionValue>({ reason: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setDisposition({ reason: "", note: "" });
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    let chosen: RejectionInput | null = null;
    if (disposition.reason) {
      const v = validateRejection(disposition);
      if (!v.ok) {
        setError(v.error);
        return;
      }
      chosen = { reason: v.value.reason, note: v.value.note };
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim(), chosen);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark Do Not Call");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onCancel} title="Mark Do Not Call">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text-primary)]">{candidateName || "This candidate"}</span>{" "}
          will be moved to Rejected and blocked from re-applying.
        </p>
        <div>
          <label htmlFor="dnc-reason" className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Do Not Call reason (optional — shown on hover)
          </label>
          <input
            id="dnc-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REJECTION_NOTE_MAX_LENGTH}
            className={fieldClass}
          />
        </div>
        <RejectionReasonFields value={disposition} onChange={setDisposition} optional idPrefix="dnc-disposition" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark Do Not Call"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
