"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type Health = {
  totalActive: number;
  reachable: number;
  missing: { id: string; name: string; email: string }[];
  invalid: { id: string; name: string; email: string }[];
};

export function AlertHealth({ health }: { health: Health }) {
  const [expanded, setExpanded] = useState(false);
  const unreachable = health.missing.length + health.invalid.length;

  if (unreachable === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center gap-2 text-sm">
        <Icon name="check_circle" size={16} className="text-emerald-500" />
        <span className="text-[var(--color-text-primary)]">
          All <strong>{health.totalActive}</strong> active employees have a valid email — emergency alerts will reach everyone.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Icon name="warning" size={16} className="text-amber-600" />
        <span className="text-sm text-[var(--color-text-primary)] flex-1">
          <strong>{unreachable}</strong> of <strong>{health.totalActive}</strong> active employees won't receive emergency emails.
          <span className="text-[var(--color-text-muted)] ml-2">({health.reachable} reachable)</span>
        </span>
        <Icon name={expanded ? "expand_less" : "expand_more"} size={16} className="text-[var(--color-text-muted)]" />
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {health.missing.map((r) => (
            <div key={r.id} className={cn("flex items-center justify-between text-xs rounded-md bg-amber-500/10 border border-amber-500/15 px-2 py-1.5")}>
              <p className="font-medium text-[var(--color-on-surface)]">{r.name}</p>
              <p className="text-[10px] text-amber-600">No email on file</p>
            </div>
          ))}
          {health.invalid.map((r) => (
            <div key={r.id} className={cn("flex items-center justify-between text-xs rounded-md bg-amber-500/10 border border-amber-500/15 px-2 py-1.5")}>
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-on-surface)] truncate">{r.name}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">{r.email}</p>
              </div>
              <p className="text-[10px] text-amber-600 shrink-0 ml-2">Invalid format</p>
            </div>
          ))}
          <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
            Fix these on the People page so the next emergency reaches them.
          </p>
        </div>
      )}
    </div>
  );
}
