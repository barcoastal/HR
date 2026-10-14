"use client";

import { cn } from "@/lib/utils";
import { CLASS_COLORS, CLASS_COLOR_META, type ClassColor, type ColorCounts } from "@/lib/recruitment-classes/logic";

export const inputClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
);

export const primaryButtonClass = cn(
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
  "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors",
  "disabled:opacity-50",
);

export const ghostButtonClass =
  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50";

export function formatStartDate(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  // Date-only key: format in UTC so the day never shifts with the viewer's zone.
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function ColorDot({ color, className }: { color: ClassColor; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", CLASS_COLOR_META[color].dot, className)} aria-hidden />;
}

export function ColorChip({ color, className }: { color: ClassColor; className?: string }) {
  const meta = CLASS_COLOR_META[color];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.chip, className)}
      title={meta.meaning}
    >
      <ColorDot color={color} />
      {meta.meaning}
    </span>
  );
}

export function ColorLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]", className)}>
      {CLASS_COLORS.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <ColorDot color={c} />
          <span className="font-medium text-[var(--color-text-primary)]">{CLASS_COLOR_META[c].label}</span>
          <span>= {CLASS_COLOR_META[c].meaning}</span>
        </span>
      ))}
    </div>
  );
}

/** Segmented Green / Yellow / Red picker. */
export function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: ClassColor;
  onChange: (c: ClassColor) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Class status color" className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-background)]">
      {CLASS_COLORS.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(c)}
            title={`${CLASS_COLOR_META[c].label}: ${CLASS_COLOR_META[c].meaning}`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              active ? cn("border", CLASS_COLOR_META[c].chip) : "border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <ColorDot color={c} />
            <span className="hidden sm:inline">{CLASS_COLOR_META[c].label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Green / Yellow / Red counts with the target headcount. */
export function CountsBar({ counts, target, className }: { counts: ColorCounts; target: number | null; className?: string }) {
  const denom = Math.max(target ?? 0, counts.total, 1);
  const pct = (n: number) => `${(n / denom) * 100}%`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {CLASS_COLORS.map((c) => (
          <span key={c} className="inline-flex items-center gap-1" title={CLASS_COLOR_META[c].meaning}>
            <ColorDot color={c} />
            <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">{counts[c]}</span>
            <span className="text-[var(--color-text-muted)]">{CLASS_COLOR_META[c].label}</span>
          </span>
        ))}
        <span className="ml-auto text-[var(--color-text-muted)] tabular-nums">
          {target ? (
            <>
              <span className="font-semibold text-[var(--color-text-primary)]">{counts.GREEN}</span> / {target} cleared
            </>
          ) : (
            <>{counts.total} candidate{counts.total === 1 ? "" : "s"}</>
          )}
        </span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-container)]" aria-hidden>
        <div className="bg-emerald-500" style={{ width: pct(counts.GREEN) }} />
        <div className="bg-amber-400" style={{ width: pct(counts.YELLOW) }} />
        <div className="bg-red-500" style={{ width: pct(counts.RED) }} />
      </div>
    </div>
  );
}
