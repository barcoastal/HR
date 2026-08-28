"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { applyGustoToEmployee } from "@/lib/actions/gusto-sync";
import type { GustoApplyOutcome, GustoMatch, GustoMatchedBy, GustoSyncStrategy } from "@/lib/gusto-sync/types";

export const MATCHED_BY_LABEL: Record<GustoMatchedBy, string> = {
  gustoId: "linked to Gusto",
  email: "matched by email",
  personalEmail: "matched by personal email",
  name: "matched by name",
};

export const STRATEGY_LABEL: Record<GustoSyncStrategy, string> = { fill: "Fill empty", overwrite: "Overwrite" };
export const STRATEGY_HINT: Record<GustoSyncStrategy, string> = {
  fill: "Only writes fields that are empty here. Nothing you already have is touched.",
  overwrite: "Gusto wins wherever it has a value. Status is never changed, and a login email is kept.",
};

export function GustoMatchChip({ matchedBy, className }: { matchedBy: GustoMatchedBy; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        matchedBy === "gustoId" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600",
        className,
      )}
    >
      <Icon name={matchedBy === "gustoId" ? "link" : "join_inner"} size={11} />
      {MATCHED_BY_LABEL[matchedBy]}
    </span>
  );
}

/** Field-by-field `Label: current → incoming`, or the reason there is nothing to show. */
export function GustoDiff({ match, className }: { match: GustoMatch | null; className?: string }) {
  if (!match) {
    return (
      <p className={cn("text-xs italic text-[var(--color-text-muted)]", className)}>
        No match in Gusto
      </p>
    );
  }
  if (match.changes.length === 0) {
    return (
      <p className={cn("inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]", className)}>
        <Icon name="check_circle" size={14} className="text-emerald-500" />
        Gusto has nothing new
      </p>
    );
  }
  return (
    <ul className={cn("space-y-0.5 text-xs", className)}>
      {match.changes.map((c) => (
        <li key={c.key} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[var(--color-text-muted)]">{c.label}:</span>
          {c.current ? (
            <span className="text-[var(--color-text-muted)] line-through">{c.current}</span>
          ) : (
            <span className="italic text-[var(--color-text-muted)]">empty</span>
          )}
          <Icon name="arrow_forward" size={12} className="self-center text-[var(--color-text-muted)]" />
          <span className="font-medium text-[var(--color-text-primary)]">{c.incoming}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two-way segmented control for the apply strategy. */
export function GustoStrategyPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: GustoSyncStrategy;
  onChange: (next: GustoSyncStrategy) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="How to apply Gusto data" className={cn("inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5", className)}>
      {(["fill", "overwrite"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={disabled}
          title={STRATEGY_HINT[s]}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
            value === s
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
          )}
        >
          {STRATEGY_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/** Strategy choice + Apply. Refreshes the route on success so the diff re-renders against the new values. */
export function GustoApplyButton({
  employeeId,
  disabled,
  onDone,
  className,
}: {
  employeeId: string;
  disabled?: boolean;
  onDone?: (outcome: GustoApplyOutcome) => void;
  className?: string;
}) {
  const router = useRouter();
  const [strategy, setStrategy] = useState<GustoSyncStrategy>("fill");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GustoApplyOutcome | null>(null);

  async function apply() {
    setError(null);
    setOutcome(null);
    setBusy(true);
    try {
      const result = await applyGustoToEmployee(employeeId, strategy);
      setOutcome(result);
      router.refresh();
      onDone?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <GustoStrategyPicker value={strategy} onChange={setStrategy} disabled={busy || disabled} />
        <button
          type="button"
          onClick={apply}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Icon name="progress_activity" size={14} className="animate-material-spin" /> : <Icon name="sync_alt" size={14} />}
          Apply Gusto
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {outcome && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {outcome.fields.length === 0 ? "Nothing to write." : `Applied ${outcome.fields.length} field${outcome.fields.length === 1 ? "" : "s"}.`}
          {outcome.notes.length > 0 && ` ${outcome.notes.join(" · ")}`}
        </p>
      )}
    </div>
  );
}
