"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CLASS_STATUS_LABEL, daysUntil, describeDaysUntil, splitAndSortClasses } from "@/lib/recruitment-classes/logic";
import type { ClassSummary } from "@/lib/recruitment-classes/types";
import { ColorLegend, CountsBar, formatStartDate } from "./class-ui";

function ClassCard({ c, todayKey, past }: { c: ClassSummary; todayKey: string; past?: boolean }) {
  const days = daysUntil(c.startDate, todayKey);
  const soon = !past && days >= 0 && days <= 7;
  return (
    <Link
      href={`/classes/${c.id}`}
      className={cn(
        "block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors",
        "hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)]",
        past && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{c.name}</p>
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {c.role}
            {c.positionTitle && c.positionTitle !== c.role ? ` · ${c.positionTitle}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-[var(--color-text-primary)]">{formatStartDate(c.startDate)}</p>
          {c.status === "UPCOMING" ? (
            <p className={cn("text-[11px]", soon ? "text-amber-700 font-semibold" : "text-[var(--color-text-muted)]")}>{describeDaysUntil(days)}</p>
          ) : (
            <p className={cn("text-[11px] font-medium", c.status === "CANCELLED" ? "text-red-600" : "text-[var(--color-text-muted)]")}>
              {CLASS_STATUS_LABEL[c.status]}
            </p>
          )}
        </div>
      </div>
      <CountsBar counts={c.counts} target={c.targetCount} className="mt-3" />
    </Link>
  );
}

export function ClassesList({ classes, todayKey }: { classes: ClassSummary[]; todayKey: string }) {
  const [showPast, setShowPast] = useState(false);
  const { upcoming, past } = splitAndSortClasses(classes, todayKey);

  return (
    <div className="space-y-6">
      <ColorLegend />

      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <Icon name="event_upcoming" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No upcoming classes</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
            A class is a role with a start date, like “Openers – Oct 12”. Create one, then add the candidates who are expected to start.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {upcoming.map((c) => (
            <ClassCard key={c.id} c={c} todayKey={todayKey} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-expanded={showPast}
          >
            <Icon name={showPast ? "expand_less" : "expand_more"} size={18} />
            Past classes ({past.length})
          </button>
          {showPast && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
              {past.map((c) => (
                <ClassCard key={c.id} c={c} todayKey={todayKey} past />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
