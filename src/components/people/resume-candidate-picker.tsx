"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { pullCandidateResumeToEmployee, searchResumeCandidates } from "@/lib/actions/employee-documents";
import type { ResumeCandidate } from "@/lib/hire-resume";

/**
 * Shown when "Pull resume" can't decide which candidate record belongs to this
 * employee (different email, several people with the same name, no match at
 * all). HR picks the right record, or searches for it by name or email.
 */
export function ResumeCandidatePicker({
  open,
  onClose,
  employeeId,
  reason,
  suggestions,
  onAttached,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  /** Why the automatic match didn't attach, e.g. "No matching candidate". */
  reason: string;
  /** Candidates that share the employee's name, if any. */
  suggestions: ResumeCandidate[];
  onAttached: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResumeCandidate[]>(suggestions);
  const [searching, setSearching] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(suggestions);
    setError(null);
    setAttachingId(null);
  }, [open, suggestions]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(suggestions);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchResumeCandidates(employeeId, q);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setError("Search failed. Try again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, employeeId, suggestions]);

  async function attach(candidate: ResumeCandidate) {
    setAttachingId(candidate.id);
    setError(null);
    try {
      const result = await pullCandidateResumeToEmployee(employeeId, candidate.id);
      if (result.success) {
        onAttached();
        onClose();
      } else {
        setError(result.error || "Could not attach resume");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach resume");
    } finally {
      setAttachingId(null);
    }
  }

  const showingSuggestions = !query.trim();

  return (
    <Dialog open={open} onClose={onClose} title="Pick the candidate record">
      <div className="space-y-4 text-sm text-[var(--color-text-primary)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          {reason}. No candidate record uses this person&apos;s profile email, which is common for people hired
          before the resume copy existed: they applied with a personal address. Choose the record that is
          theirs and the resume is copied onto this profile (HR only).
        </p>

        <label className="block">
          <span className="sr-only">Search candidates</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates by name or email…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        {showingSuggestions && results.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">Candidates with the same name:</p>
        )}

        {results.length > 0 && (
          <ul className="max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)]">
            {results.map((c) => {
              const busy = attachingId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={!c.hasResume || attachingId !== null}
                    onClick={() => attach(c)}
                    title={c.hasResume ? "Copy this resume onto the profile" : "This candidate record has no resume"}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {c.email}
                        {c.positionTitle ? ` · ${c.positionTitle}` : ""}
                        {` · applied ${new Date(c.appliedAt).toLocaleDateString()}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                        c.hasResume ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
                      )}
                    >
                      {busy ? "Copying…" : c.hasResume ? "Resume" : "No resume"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {searching && <p className="text-xs text-[var(--color-text-muted)]">Searching…</p>}
        {!searching && results.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {showingSuggestions
              ? "No candidate shares this person's name. Search for the name they applied under."
              : `No candidate matches “${query.trim()}”.`}
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon name="close" size={12} /> Cancel
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
