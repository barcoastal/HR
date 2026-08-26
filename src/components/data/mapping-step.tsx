"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EMPLOYEE_FIELDS, FIELD_GROUPS } from "@/lib/import-export/employee-fields";
import type { ColumnMapping, FieldKey } from "@/lib/import-export/types";

const SELECT_CLASS =
  "w-full px-2 py-1.5 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40";

export function MappingStep({
  headers,
  mapping,
  sampleRows,
  readOnly,
  onSave,
}: {
  headers: string[];
  mapping: ColumnMapping | null;
  sampleRows: string[][];
  readOnly: boolean;
  onSave: (m: ColumnMapping) => void;
}) {
  const [local, setLocal] = useState<ColumnMapping>(mapping ?? headers.map(() => "skip"));
  const used = new Set(local.filter((m) => m !== "skip"));
  const complete = local.includes("firstName") && local.includes("lastName");
  const dirty = JSON.stringify(local) !== JSON.stringify(mapping);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        Tell us which field each column feeds. Columns set to “(Skip)” are ignored. First and last name are required.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium w-56">Column in file</th>
              <th className="px-4 py-2 text-left font-medium w-64">Field</th>
              <th className="px-4 py-2 text-left font-medium">Sample values</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">
                  {h || <span className="text-[var(--color-text-muted)]">(blank header)</span>}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={local[i]}
                    disabled={readOnly}
                    className={SELECT_CLASS}
                    onChange={(e) => {
                      const next = e.target.value as FieldKey | "skip";
                      setLocal((m) => m.map((v, j) => (j === i ? next : v)));
                    }}
                  >
                    <option value="skip">(Skip)</option>
                    {FIELD_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {EMPLOYEE_FIELDS.filter((f) => f.group === g).map((f) => (
                          <option key={f.key} value={f.key} disabled={used.has(f.key) && local[i] !== f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-[var(--color-text-muted)] text-xs">
                  {sampleRows
                    .map((r) => r[i])
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!complete && <p className="text-xs text-red-500">Map both First name and Last name to continue.</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSave(local)}
            disabled={!complete}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50",
            )}
          >
            {dirty ? "Save mapping & review" : "Continue to review"}
          </button>
        </div>
      )}
    </div>
  );
}
