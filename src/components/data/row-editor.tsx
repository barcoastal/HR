"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { updateImportRow, type ImportRowView } from "@/lib/actions/imports";
import { EMPLOYEE_FIELDS, FIELD_GROUPS } from "@/lib/import-export/employee-fields";
import type { FieldDef, FieldKey, RowData } from "@/lib/import-export/types";

// ---------------------------------------------------------------------------
// Shared bits (also used by review-step and compare-panel)
// ---------------------------------------------------------------------------

export type Badge = { label: string; className: string };

const ACTION_BADGE: Record<ImportRowView["action"], Badge> = {
  CREATE: { label: "New", className: "bg-emerald-500/10 text-emerald-600" },
  UPDATE: { label: "Update", className: "bg-blue-500/10 text-blue-600" },
  SKIP: { label: "Skipped", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" },
  MERGED_AWAY: { label: "Merged", className: "bg-purple-500/10 text-purple-600" },
};
const INVALID_BADGE: Badge = { label: "Needs attention", className: "bg-red-500/10 text-red-500" };

export const BUTTON = {
  primary:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors",
  secondary:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors",
  subtle:
    "inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:pointer-events-none transition-colors",
};

/** Chip text/colour for a row: invalid rows read "Needs attention" instead of "Skipped". */
export function rowBadge(row: Pick<ImportRowView, "action" | "skipReason">): Badge {
  if (row.action === "SKIP" && row.skipReason === "invalid") return INVALID_BADGE;
  return ACTION_BADGE[row.action] ?? ACTION_BADGE.SKIP;
}

export function rowDisplayName(data: RowData): string {
  return `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
}

export function Chip({ badge, className }: { badge: Badge; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap", badge.className, className)}>
      {badge.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Row editor
// ---------------------------------------------------------------------------

type Run = (fn: () => Promise<void>) => void;

type Props = {
  batchId: string;
  row: ImportRowView;
  readOnly: boolean;
  busy: boolean;
  run: Run;
  onSkip: () => void;
  onUnskip: () => void;
};

const INPUT =
  "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-light)] disabled:cursor-not-allowed disabled:opacity-50";

function statusLine(row: ImportRowView): string {
  switch (row.action) {
    case "CREATE":
      return "Will be added as a new person.";
    case "UPDATE":
      return "Will update an existing person.";
    case "MERGED_AWAY":
      return "Merged into another row.";
    default:
      return row.skipReason === "invalid"
        ? "Needs attention — fix the errors below to include this row."
        : "Skipped — this row will not be imported.";
  }
}

/** Changes whenever the server-side row changes, so the form remounts with fresh values after a save. */
function formKey(row: ImportRowView): string {
  return [row.action, row.skipReason ?? "", JSON.stringify(row.data), JSON.stringify(row.errors)].join("|");
}

export function RowEditor({ batchId, row, readOnly, busy, run, onSkip, onUnskip }: Props) {
  const mergedAway = row.action === "MERGED_AWAY";
  const rowLevelErrors = row.errors.filter((e) => e.field === "row");

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Row {row.rowNumber}</h3>
          <Chip badge={rowBadge(row)} />
          {rowDisplayName(row.data) && (
            <span className="text-sm text-[var(--color-text-muted)] truncate">{rowDisplayName(row.data)}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{statusLine(row)}</p>
        {rowLevelErrors.map((e, i) => (
          <p key={i} className="mt-1 text-xs text-red-500">{e.message}</p>
        ))}
      </div>

      {mergedAway ? (
        <p className="p-4 text-sm text-[var(--color-text-muted)]">
          This row was merged into another row. Undo the merge from its duplicate group to edit it again.
        </p>
      ) : (
        <RowForm
          key={formKey(row)}
          batchId={batchId}
          row={row}
          disabled={readOnly}
          busy={busy}
          run={run}
          onSkip={onSkip}
          onUnskip={onUnskip}
        />
      )}
    </div>
  );
}

type FormProps = Omit<Props, "readOnly"> & { disabled: boolean };

function RowForm({ batchId, row, disabled, busy, run, onSkip, onUnskip }: FormProps) {
  const [values, setValues] = useState<RowData>(() => ({ ...row.data }));
  const errorByField = new Map(row.errors.filter((e) => e.field !== "row").map((e) => [e.field, e.message]));
  const dirty = EMPLOYEE_FIELDS.some((f) => (values[f.key] ?? "") !== (row.data[f.key] ?? ""));
  const canSkip = row.action === "CREATE" || row.action === "UPDATE";
  const canUnskip = row.action === "SKIP" && row.skipReason === "user";
  const locked = disabled || busy;

  function setValue(key: FieldKey, value: string) {
    setValues((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (locked || !dirty) return;
        run(() => updateImportRow(batchId, row.id, values));
      }}
    >
      <div className="p-4 space-y-5">
        {FIELD_GROUPS.map((groupName) => (
          <fieldset key={groupName} disabled={locked}>
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{groupName}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {EMPLOYEE_FIELDS.filter((f) => f.group === groupName).map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  error={errorByField.get(field.key)}
                  onChange={(v) => setValue(field.key, v)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
          <button type="submit" className={BUTTON.primary} disabled={locked || !dirty}>
            <Icon name="save" size={14} /> Save
          </button>
          {canSkip && (
            <button type="button" className={BUTTON.secondary} onClick={onSkip} disabled={locked}>
              <Icon name="block" size={14} /> Skip row
            </button>
          )}
          {canUnskip && (
            <button type="button" className={BUTTON.secondary} onClick={onUnskip} disabled={locked}>
              <Icon name="undo" size={14} /> Unskip row
            </button>
          )}
          {dirty && <span className="text-[11px] text-[var(--color-text-muted)]">Unsaved changes</span>}
        </div>
      )}
    </form>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `import-row-${field.key}`;
  const className = cn(INPUT, error && "border-red-500 focus:border-red-500");

  let control: React.ReactNode;
  if (field.type === "enum") {
    control = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        <option value="">—</option>
        {field.enumValues?.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  } else {
    // Valid dates are always stored as YYYY-MM-DD, so a native date picker works.
    // When the cell failed validation the cleaned value is gone; fall back to free text.
    const isDate = field.type === "date" && !error;
    control = (
      <input
        id={id}
        type={isDate ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.type === "date" ? "e.g. 2024-03-05" : undefined}
        className={className}
      />
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block mb-1 text-[11px] font-medium text-[var(--color-text-muted)]">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>
      {control}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
