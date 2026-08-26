"use client";

import { Icon } from "@/components/ui/icon";
import type { ImportBatchDetail } from "@/lib/actions/imports";

export function ImportStep({ detail }: { detail: ImportBatchDetail }) {
  const s = detail.stats;
  const blocked = s.needsDecision > 0 || s.needsAttention > 0;
  const tiles = [
    { label: "New people", value: s.newPeople, icon: "person_add" },
    { label: "Updates to existing", value: s.updates, icon: "sync_alt" },
    { label: "Merged into another row", value: s.mergedAway, icon: "merge" },
    { label: "Skipped", value: s.skipped, icon: "block" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Icon name={t.icon} size={14} />
              {t.label}
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{t.value}</p>
          </div>
        ))}
      </div>
      {blocked && (
        <p className="text-xs text-amber-600">
          {s.needsDecision > 0 &&
            `${s.needsDecision} duplicate group${s.needsDecision === 1 ? "" : "s"} still need a decision. `}
          {s.needsAttention > 0 && `${s.needsAttention} row${s.needsAttention === 1 ? "" : "s"} have errors to fix or skip.`}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-[var(--color-text-muted)]">Importing into the system is the next build.</span>
        <button
          type="button"
          disabled
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white opacity-50 cursor-not-allowed"
        >
          Import — next
        </button>
      </div>
    </div>
  );
}
