"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { DATE_PRESETS, type DatePreset, type Interval } from "@/lib/recruitment-metrics";

type Option = { value: string; label: string };

export type RecruitmentFilterState = {
  preset: DatePreset;
  from: string;
  to: string;
  position: string;
  source: string;
  recruiter: string;
  interval: Interval;
};

const selectClass = cn(
  "px-3 py-2 rounded-lg text-sm min-w-0",
  "bg-[var(--color-surface)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
);

function toQuery(s: RecruitmentFilterState): string {
  const p = new URLSearchParams();
  p.set("range", s.preset);
  if (s.preset === "custom") {
    if (s.from) p.set("from", s.from);
    if (s.to) p.set("to", s.to);
  }
  if (s.position) p.set("position", s.position);
  if (s.source) p.set("source", s.source);
  if (s.recruiter) p.set("recruiter", s.recruiter);
  p.set("interval", s.interval);
  return p.toString();
}

export function RecruitmentFilters({
  initial,
  positions,
  sources,
  recruiters,
  recruiterLocked,
  exportQuery,
}: {
  initial: RecruitmentFilterState;
  positions: Option[];
  sources: Option[];
  recruiters: Option[];
  /** Scoped recruiters only see their own numbers; the recruiter filter is fixed. */
  recruiterLocked: boolean;
  /** Query string of the filters currently applied on the server. */
  exportQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  const apply = (next: RecruitmentFilterState) => {
    setState(next);
    if (next.preset === "custom" && (!next.from || !next.to)) return; // wait for both dates
    startTransition(() => router.push(`${pathname}?${toQuery(next)}`, { scroll: false }));
  };
  const set = <K extends keyof RecruitmentFilterState>(key: K, value: RecruitmentFilterState[K]) =>
    apply({ ...state, [key]: value });

  const hasDimensionFilter = !!(state.position || state.source || (!recruiterLocked && state.recruiter));

  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)] p-4 mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Date range
          <select
            className={selectClass}
            value={state.preset}
            onChange={(e) => {
              const preset = e.target.value as DatePreset;
              apply({ ...state, preset, interval: preset === "12m" || preset === "ytd" ? "month" : preset === "custom" ? state.interval : "week" });
            }}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        {state.preset === "custom" && (
          <>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              From
              <input type="date" className={selectClass} value={state.from} max={state.to || undefined} onChange={(e) => set("from", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              To
              <input type="date" className={selectClass} value={state.to} min={state.from || undefined} onChange={(e) => set("to", e.target.value)} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Position
          <select className={selectClass} value={state.position} onChange={(e) => set("position", e.target.value)}>
            <option value="">All positions</option>
            {positions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Source
          <select className={selectClass} value={state.source} onChange={(e) => set("source", e.target.value)}>
            <option value="">All sources</option>
            {sources.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Recruiter
          <select
            className={selectClass}
            value={state.recruiter}
            disabled={recruiterLocked}
            onChange={(e) => set("recruiter", e.target.value)}
          >
            {!recruiterLocked && <option value="">All recruiters</option>}
            {recruiters.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Group by
          <select className={selectClass} value={state.interval} onChange={(e) => set("interval", e.target.value as Interval)}>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        {hasDimensionFilter && (
          <button
            type="button"
            className="h-9 px-3 text-xs rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            onClick={() => apply({ ...state, position: "", source: "", recruiter: recruiterLocked ? state.recruiter : "" })}
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {pending && <span className="text-xs text-[var(--color-text-muted)]">Updating…</span>}
          <a
            href={`/api/analytics/recruitment/export?format=xlsx&${exportQuery}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium gradient-primary text-white hover:brightness-105"
          >
            <Icon name="download" size={16} />
            Export report
          </a>
        </div>
      </div>
    </div>
  );
}
