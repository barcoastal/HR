"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { listPeopleForCompare, type ComparePerson } from "@/lib/actions/duplicates";
import { BUTTON } from "./row-editor";
import { statusBadge } from "./compare-table";

/**
 * Pick two or more people by name or email and open them side by side on the Duplicates tab —
 * for look-alikes the scan cannot see because nothing (email, phone, spelling) matches exactly.
 */
export function ComparePeoplePicker({ open, onClose, initialIds }: { open: boolean; onClose: () => void; initialIds: string[] }) {
  const router = useRouter();
  const [people, setPeople] = useState<ComparePerson[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(initialIds);
    setQuery("");
    setError(null);
    listPeopleForCompare()
      .then(setPeople)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load people"));
  }, [open, initialIds]);

  const byId = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !people) return [];
    return people
      .filter((p) => !selected.includes(p.id) && (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [people, query, selected]);

  function add(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
  }
  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }
  function compare() {
    onClose();
    router.push(`/data?tab=duplicates&people=${selected.join(",")}`);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Compare people">
      <div className="space-y-4 text-sm text-[var(--color-text-primary)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Pick two or more records to see them side by side and merge them into one. Use this when the same person has two profiles the scan
          doesn’t pair — a different email, phone or spelling of the name.
        </p>

        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((id) => {
              const p = byId.get(id);
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-2.5 pr-1 text-xs"
                >
                  <span className="font-medium">{p?.name ?? (people ? "Unknown person" : "Loading…")}</span>
                  {p && <span className="text-[var(--color-text-muted)]">{p.email}</span>}
                  <button
                    type="button"
                    aria-label={`Remove ${p?.name ?? "person"}`}
                    onClick={() => remove(id)}
                    className="rounded-full p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className="block">
          <span className="sr-only">Search people</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={people ? "Search by name or email…" : "Loading people…"}
            disabled={!people}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
          />
        </label>

        {matches.length > 0 && (
          <ul className="max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)]">
            {matches.map((p) => {
              const badge = statusBadge(p.status);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => add(p.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">{p.email}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px]", badge.className)}>{badge.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {query.trim() && people && matches.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            No one matches “{query.trim()}”. Archived people aren’t listed — restore them from the People archive first.
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={BUTTON.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={BUTTON.primary} disabled={selected.length < 2} onClick={compare}>
            <Icon name="compare_arrows" size={14} /> Compare{selected.length >= 2 ? ` ${selected.length} people` : ""}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
