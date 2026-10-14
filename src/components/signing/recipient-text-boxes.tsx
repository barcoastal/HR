"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { TEXT_BOX_MAX_LENGTH, type TextBoxField } from "@/lib/text-box-fields";

/**
 * Text boxes as the recipient sees them while signing: HR-only boxes are
 * read-only, shared boxes start with HR's value and can be edited, recipient
 * boxes start empty.
 */
export function RecipientTextBoxes({
  fields,
  values,
  onChange,
  accent = "green",
}: {
  fields: TextBoxField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  accent?: "green" | "teal";
}) {
  if (fields.length === 0) return null;
  const anyEditable = fields.some((f) => f.filledBy !== "admin");
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="text_fields" size={16} className={accent === "teal" ? "text-teal-600" : "text-green-600"} />
          {anyEditable ? "Fill in the following" : "Filled in by HR"}
        </h2>
      </div>
      <div className="p-5 space-y-4">
        {fields.map((f) => (
          <div key={f.fieldId}>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              {f.label}
              {f.filledBy === "admin" ? (
                <span className="normal-case tracking-normal font-normal text-gray-400">Filled in by HR</span>
              ) : !f.required ? (
                <span className="normal-case tracking-normal font-normal text-gray-400">Optional</span>
              ) : null}
            </label>
            {f.filledBy === "admin" ? (
              <div className={cn(
                "px-4 py-3 rounded-lg border",
                f.value ? "bg-gray-50 border-gray-200 text-gray-800 text-base" : "bg-amber-50 border-amber-200 text-amber-800 text-sm"
              )}>
                {f.value || (f.required ? "Waiting for HR to fill this in" : "Left blank by HR")}
              </div>
            ) : (
              <input
                type="text"
                value={values[f.fieldId] ?? ""}
                onChange={(e) => onChange(f.fieldId, e.target.value)}
                placeholder={`Enter ${f.label.toLowerCase()}`}
                maxLength={TEXT_BOX_MAX_LENGTH}
                className={cn(
                  "w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2",
                  accent === "teal" ? "focus:ring-teal-500/40 focus:border-teal-500" : "focus:ring-green-500/40 focus:border-green-500"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WaitingOnHrNotice({ labels }: { labels: string[] }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
      <Icon name="hourglass_top" size={16} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-900">HR still needs to complete part of this document</p>
        <p className="text-xs text-amber-800 mt-0.5">
          Waiting on: {labels.join(", ")}. You&apos;ll be able to finish once HR fills these in — you can use this same link then.
        </p>
      </div>
    </div>
  );
}
