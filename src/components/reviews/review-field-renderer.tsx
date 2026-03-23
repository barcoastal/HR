"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { TemplateField } from "@/lib/review-templates";

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

interface FieldRendererProps {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}

export function ReviewFieldRenderer({ field, value, onChange, readOnly = false }: FieldRendererProps) {
  if (readOnly) return <ReadOnlyField field={field} value={value} />;
  return <EditableField field={field} value={value} onChange={onChange} />;
}

function EditableField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "star_rating": {
      const current = (value as number) || 0;
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Icon
                  name="star"
                  fill={n <= current}
                  className={cn("h-7 w-7 transition-colors", n <= current ? "text-amber-400" : "text-[var(--color-border)]")}
                />
              </button>
            ))}
            {current > 0 && <span className="ml-2 text-sm text-[var(--color-text-muted)] self-center">{current}/5</span>}
          </div>
        </div>
      );
    }

    case "numeric_scale": {
      const min = field.options.min ?? 1;
      const max = field.options.max ?? 10;
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={min}
              max={max}
              value={(value as number) || min}
              onChange={(e) => onChange(parseInt(e.target.value))}
              className="flex-1 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)] min-w-[2rem] text-center">
              {(value as number) ?? min}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">/ {max}</span>
          </div>
        </div>
      );
    }

    case "text_area":
      return (
        <div>
          <FieldLabel field={field} />
          <textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value.slice(0, 5000))}
            rows={3}
            className={inputClass}
            maxLength={5000}
          />
        </div>
      );

    case "short_text":
      return (
        <div>
          <FieldLabel field={field} />
          <input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value.slice(0, 500))}
            className={inputClass}
            maxLength={500}
          />
        </div>
      );

    case "multiple_choice": {
      const choices = field.options.choices || [];
      return (
        <div>
          <FieldLabel field={field} />
          <div className="space-y-1.5">
            {choices.map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  checked={value === choice}
                  onChange={() => onChange(choice)}
                  className="accent-[var(--color-accent)]"
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "checkbox_list": {
      const choices = field.options.choices || [];
      const selected = (value as string[]) || [];
      return (
        <div>
          <FieldLabel field={field} />
          <div className="space-y-1.5">
            {choices.map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(choice)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, choice]);
                    else onChange(selected.filter((s) => s !== choice));
                  }}
                  className="rounded accent-[var(--color-accent)]"
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "yes_no":
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex gap-3">
            {[
              { label: "Yes", val: true },
              { label: "No", val: false },
            ].map(({ label, val }) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(val)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  value === val
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      );
  }
}

function ReadOnlyField({ field, value }: { field: TemplateField; value: unknown }) {
  switch (field.type) {
    case "star_rating": {
      const n = (value as number) || 0;
      return (
        <div>
          <FieldLabel field={field} readOnly />
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Icon key={i} name="star" fill={i <= n} size={20} className={i <= n ? "text-amber-400" : "text-[var(--color-border)]"} />
            ))}
            <span className="ml-2 text-sm text-[var(--color-text-muted)]">{n}/5</span>
          </div>
        </div>
      );
    }

    case "numeric_scale": {
      const max = field.options.max ?? 10;
      return (
        <div>
          <FieldLabel field={field} readOnly />
          <p className="text-sm text-[var(--color-text-primary)]">
            <span className="font-semibold">{value as number}</span>
            <span className="text-[var(--color-text-muted)]"> / {max}</span>
          </p>
        </div>
      );
    }

    case "text_area":
    case "short_text":
      return value ? (
        <div>
          <FieldLabel field={field} readOnly />
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{value as string}</p>
        </div>
      ) : null;

    case "multiple_choice":
      return value ? (
        <div>
          <FieldLabel field={field} readOnly />
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            {value as string}
          </span>
        </div>
      ) : null;

    case "checkbox_list": {
      const selected = (value as string[]) || [];
      return selected.length > 0 ? (
        <div>
          <FieldLabel field={field} readOnly />
          <div className="flex flex-wrap gap-1">
            {selected.map((s) => (
              <span key={s} className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null;
    }

    case "yes_no":
      return value !== undefined && value !== null ? (
        <div>
          <FieldLabel field={field} readOnly />
          <span
            className={cn(
              "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
              value ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}
          >
            {value ? "Yes" : "No"}
          </span>
        </div>
      ) : null;
  }
}

function FieldLabel({ field, readOnly = false }: { field: TemplateField; readOnly?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
      {field.label}
      {field.required && !readOnly && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
