"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  TEXT_BOX_FILLED_BY_OPTIONS,
  TEXT_BOX_MAX_LENGTH,
  type TextBoxField,
  type TextBoxFilledBy,
} from "@/lib/text-box-fields";

export function textBoxOwnerShortLabel(filledBy: TextBoxFilledBy): string {
  return filledBy === "admin" ? "HR" : filledBy === "both" ? "HR + recipient" : "recipient";
}

export function TextBoxFilledBySelect({
  value,
  onChange,
  className,
}: {
  value: TextBoxFilledBy;
  onChange: (value: TextBoxFilledBy) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TextBoxFilledBy)}
      title={TEXT_BOX_FILLED_BY_OPTIONS.find((o) => o.value === value)?.description}
      className={cn(
        "px-1.5 py-1 rounded border border-green-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500",
        className
      )}
    >
      {TEXT_BOX_FILLED_BY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** One placed text box: label, who fills it in, required. */
export function TextBoxSettingsRow({
  label,
  filledBy,
  required,
  page,
  onChange,
  onRemove,
}: {
  label: string;
  filledBy: TextBoxFilledBy;
  required: boolean;
  page: number;
  onChange: (changes: { label?: string; filledBy?: TextBoxFilledBy; required?: boolean }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5">
      <Icon name="text_fields" size={12} className="text-green-600" />
      <input
        value={label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label"
        aria-label="Text box label"
        className="flex-1 min-w-[120px] px-2 py-1 rounded border border-green-300 bg-white text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
      />
      <span className="text-[10px] text-[var(--color-text-muted)]">Filled by</span>
      <TextBoxFilledBySelect value={filledBy} onChange={(v) => onChange({ filledBy: v })} />
      <label className="flex items-center gap-1 text-[11px] text-[var(--color-text-primary)]">
        <input type="checkbox" checked={required} onChange={(e) => onChange({ required: e.target.checked })} className="h-3 w-3" />
        Required
      </label>
      <span className="text-[10px] text-[var(--color-text-muted)]">p{page}</span>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-500 text-xs font-bold" aria-label="Remove text box">
        ×
      </button>
    </div>
  );
}

/** Inputs for HR's part of a document: the HR-only and shared text boxes. */
export function AdminTextBoxInputs({
  fields,
  values,
  onChange,
  inputClassName,
}: {
  fields: TextBoxField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  inputClassName?: string;
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.fieldId}>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-primary)] mb-1">
            {f.label}
            <span className="font-normal text-[var(--color-text-muted)]">
              {f.filledBy === "both" ? "Recipient can edit" : "Recipient sees, can't edit"}
              {f.filledBy === "admin" && f.required ? " · Required" : !f.required ? " · Optional" : ""}
            </span>
          </label>
          <input
            type="text"
            value={values[f.fieldId] ?? ""}
            maxLength={TEXT_BOX_MAX_LENGTH}
            onChange={(e) => onChange(f.fieldId, e.target.value)}
            placeholder={f.filledBy === "both" ? "Optional pre-fill" : `Enter ${f.label.toLowerCase()}`}
            className={inputClassName}
          />
        </div>
      ))}
    </div>
  );
}
