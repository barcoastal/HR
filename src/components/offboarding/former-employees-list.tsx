"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  filterByRehireStatus,
  rehireStatus,
  REHIRE_LABELS,
  type RehireFilter,
  type RehireStatus,
} from "@/lib/rehire-eligibility";

type FormerEmployee = {
  id: string;
  name: string;
  initials: string;
  jobTitle: string;
  departmentName: string | null;
  endDate: string | null;
  rehireEligible: boolean | null;
  rehireNotes: string | null;
  documentCount: number;
};

const BADGE_STYLES: Record<RehireStatus, string> = {
  ELIGIBLE: "bg-emerald-500/10 text-emerald-600",
  NOT_ELIGIBLE: "bg-red-500/10 text-red-500",
  UNDECIDED: "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
};

const BADGE_ICONS: Record<RehireStatus, string> = {
  ELIGIBLE: "check_circle",
  NOT_ELIGIBLE: "block",
  UNDECIDED: "help",
};

const FILTERS: { key: RehireFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ELIGIBLE", label: "Eligible for rehire" },
  { key: "NOT_ELIGIBLE", label: "Not eligible" },
  { key: "UNDECIDED", label: "Not decided" },
];

// The last working day is stored as a calendar date at midnight UTC, so it is
// shown in UTC to keep it from slipping to the previous day in US time zones.
function formatLastDay(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

export function RehireBadge({ eligible }: { eligible: boolean | null }) {
  const status = rehireStatus(eligible);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", BADGE_STYLES[status])}>
      <Icon name={BADGE_ICONS[status]} size={12} />
      {REHIRE_LABELS[status]}
    </span>
  );
}

/** Everyone who has left, with whether they can be rehired and a way into their file. */
export function FormerEmployeesList({ people }: { people: FormerEmployee[] }) {
  const [filter, setFilter] = useState<RehireFilter>("ALL");
  const shown = filterByRehireStatus(people, filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const count = filterByRehireStatus(people, option.key).length;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                filter === option.key
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              )}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-text-muted)] py-8">No former employees match this filter.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((person) => (
            <Link
              key={person.id}
              href={`/people/${person.id}`}
              className={cn(
                "block rounded-2xl p-4 transition-colors",
                "bg-[var(--color-surface)] border border-[var(--color-border)]",
                "hover:bg-[var(--color-surface-hover)]"
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {person.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{person.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {person.jobTitle}
                    {person.departmentName ? ` · ${person.departmentName}` : ""}
                    {person.endDate ? ` · Last day ${formatLastDay(person.endDate)}` : ""}
                  </p>
                  {person.rehireNotes && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2">{person.rehireNotes}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <Icon name="description" size={12} />
                    {person.documentCount} document{person.documentCount === 1 ? "" : "s"}
                  </span>
                  <RehireBadge eligible={person.rehireEligible} />
                  <Icon name="chevron_right" size={16} className="text-[var(--color-text-muted)]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
