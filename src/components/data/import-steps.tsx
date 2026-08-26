"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export type ImportStepId = "map" | "review" | "import";

const STEPS: { id: "upload" | ImportStepId; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Map columns" },
  { id: "review", label: "Review" },
  { id: "import", label: "Import" },
];

export function ImportSteps({
  current,
  onSelect,
  canReview,
}: {
  current: ImportStepId;
  onSelect: (s: ImportStepId) => void;
  canReview: boolean;
}) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 mb-6 flex-wrap">
      {STEPS.map((s, i) => {
        const done = i < idx || s.id === "upload";
        const active = s.id === current;
        const clickable = s.id !== "upload" && (s.id === "map" || canReview);
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (s.id !== "upload" && clickable) onSelect(s.id);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : done
                    ? "border-emerald-500/30 text-emerald-600"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]",
                clickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              {done && !active ? <Icon name="check" size={14} /> : <span className="w-4 text-center">{i + 1}</span>}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <Icon name="chevron_right" size={16} className="text-[var(--color-text-muted)]" />}
          </li>
        );
      })}
    </ol>
  );
}
