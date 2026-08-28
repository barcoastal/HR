"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { approveAndInviteEmployee, bulkApproveAndInviteEmployees, deletePendingEmployees } from "@/lib/actions/employees";
import { applyGustoToEmployees, getGustoMatches } from "@/lib/actions/gusto-sync";
import { EMPLOYEE_FIELDS } from "@/lib/import-export/employee-fields";
import type { RowData } from "@/lib/import-export/types";
import type { GustoApplyResult, GustoMatch, GustoSyncStrategy } from "@/lib/gusto-sync/types";
import { GustoApplyButton, GustoDiff, GustoMatchChip, GustoStrategyPicker, STRATEGY_HINT } from "./gusto-compare";

export type PendingPerson = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  jobTitle: string;
  department: string | null;
  createdAt: string;
  /** Every employee field, flattened (department/team/manager as names). */
  data: RowData;
};

const BUTTON = {
  primary: "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50",
  accent: "inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50",
  danger: "inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50",
  subtle: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50",
};

type GustoState = { matches: Record<string, GustoMatch | null>; fetchedAt: string };

/** Review table for people who exist in the system but have no login yet. */
export function PendingPeople({ people, gustoConnected = false }: { people: PendingPerson[]; gustoConnected?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"approve" | "delete" | "gusto" | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(true);

  // Gusto comparison: loaded on demand, reloaded whenever the people list re-renders after a change.
  const [showGusto, setShowGusto] = useState(false);
  const [gusto, setGusto] = useState<GustoState | null>(null);
  const [gustoLoading, setGustoLoading] = useState(false);
  const [gustoError, setGustoError] = useState<string | null>(null);
  const [gustoReload, setGustoReload] = useState(0);
  const [applyAll, setApplyAll] = useState(false);
  const [applyStrategy, setApplyStrategy] = useState<GustoSyncStrategy>("fill");
  const [applyResult, setApplyResult] = useState<GustoApplyResult | null>(null);

  const sorted = useMemo(() => [...people].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [people]);
  const byDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) counts.set(p.createdAt.slice(0, 10), (counts.get(p.createdAt.slice(0, 10)) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [people]);

  // Columns: every employee field; by default hide the ones nobody has filled in.
  const columns = useMemo(
    () => EMPLOYEE_FIELDS.filter((f) => !hideEmpty || people.some((p) => (p.data[f.key] ?? "").trim() !== "")),
    [hideEmpty, people],
  );
  const hiddenCount = EMPLOYEE_FIELDS.length - columns.length;

  const gustoOn = gustoConnected && showGusto;
  useEffect(() => {
    if (!gustoOn) return;
    let cancelled = false;
    setGustoLoading(true);
    setGustoError(null);
    getGustoMatches(people.map((p) => p.id))
      .then((r) => {
        if (!cancelled) setGusto({ matches: r.matches, fetchedAt: r.fetchedAt });
      })
      .catch((e) => {
        if (!cancelled) setGustoError(e instanceof Error ? e.message : "Could not reach Gusto");
      })
      .finally(() => {
        if (!cancelled) setGustoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gustoOn, people, gustoReload]);

  const gustoStats = useMemo(() => {
    if (!gusto) return null;
    const matchedIds: string[] = [];
    let withChanges = 0;
    for (const p of people) {
      const m = gusto.matches[p.id];
      if (!m) continue;
      matchedIds.push(p.id);
      if (m.changes.length > 0) withChanges++;
    }
    return { matched: matchedIds.length, noMatch: people.length - matchedIds.length, withChanges, matchedIds };
  }, [gusto, people]);

  const allSelected = people.length > 0 && selected.size === people.length;
  const targets = selected.size > 0 ? Array.from(selected) : people.map((p) => p.id);
  const targetLabel = selected.size > 0 ? `${selected.size} selected` : `all ${people.length}`;
  const nameOf = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.preferredName || p.firstName} ${p.lastName}` : id;
  };

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(kind: "approve" | "delete", fn: () => Promise<unknown>) {
    setError(null);
    setBusy(kind);
    try {
      await fn();
      setSelected(new Set());
      setConfirmDelete(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function approveOne(id: string) {
    setError(null);
    setRowBusy(id);
    try {
      await approveAndInviteEmployee(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRowBusy(null);
    }
  }

  async function runApplyAll() {
    if (!gustoStats || gustoStats.matched === 0) return;
    setError(null);
    setBusy("gusto");
    try {
      const result = await applyGustoToEmployees(gustoStats.matchedIds, applyStrategy);
      setApplyResult(result);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setApplyAll(false);
    } finally {
      setBusy(null);
    }
  }

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Nobody is pending approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-[var(--color-text-primary)]">
        <p className="font-medium">
          {people.length} people are in the system without a login. Approving sends each of them a welcome email with an invitation; deleting removes the record entirely.
        </p>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Created on:{" "}
          {byDay.slice(0, 4).map(([day, n], i) => (
            <span key={day}>
              {i > 0 && " · "}
              <strong>{formatDate(day)}</strong> ({n})
            </span>
          ))}
          {byDay.length > 4 && ` · +${byDay.length - 4} more days`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(people.map((p) => p.id)))}
            className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            aria-label="Select all pending people"
          />
          Select all
          {selected.size > 0 && <span>· {selected.size} selected</span>}
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]" />
          Hide empty columns{hideEmpty && hiddenCount > 0 ? ` (${hiddenCount})` : ""}
        </label>
        <Link href="/data?tab=duplicates&involving=PENDING" className={BUTTON.subtle}>
          <Icon name="call_merge" size={14} /> Find duplicates among these
        </Link>
        {gustoConnected && (
          <button
            type="button"
            aria-pressed={showGusto}
            className={cn(BUTTON.subtle, showGusto && "border-[var(--color-accent)] text-[var(--color-accent)]")}
            onClick={() => setShowGusto((v) => !v)}
          >
            <Icon name="sync_alt" size={14} /> {showGusto ? "Hide Gusto data" : "Show Gusto data"}
          </button>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className={BUTTON.primary}
            disabled={busy !== null}
            onClick={() => {
              if (!confirm(`Approve ${targetLabel} and send login invitations?`)) return;
              run("approve", () => bulkApproveAndInviteEmployees(targets));
            }}
          >
            {busy === "approve" ? <Icon name="progress_activity" size={14} className="animate-material-spin" /> : <Icon name="how_to_reg" size={14} />}
            Approve {targetLabel}
          </button>
          <button type="button" className={BUTTON.danger} disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
            <Icon name="delete" size={14} /> Delete {targetLabel}
          </button>
        </span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {gustoOn && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-2.5 text-xs">
          <Icon name="sync_alt" size={14} className="text-[var(--color-accent)]" />
          {gustoError ? (
            <span className="text-red-500">{gustoError}</span>
          ) : !gustoStats ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <Icon name="progress_activity" size={14} className="animate-material-spin" /> Checking Gusto…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[var(--color-text-primary)]">
              <span>
                <strong>{gustoStats.matched}</strong> matched · <strong>{gustoStats.noMatch}</strong> no match
                {gustoStats.withChanges > 0 && (
                  <span className="text-[var(--color-text-muted)]"> · {gustoStats.withChanges} with changes</span>
                )}
              </span>
              {gustoLoading && <Icon name="progress_activity" size={14} className="animate-material-spin text-[var(--color-text-muted)]" />}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {gustoError && (
              <button type="button" className={BUTTON.subtle} onClick={() => setGustoReload((n) => n + 1)}>
                <Icon name="refresh" size={14} /> Retry
              </button>
            )}
            <button
              type="button"
              className={BUTTON.accent}
              disabled={!gustoStats || gustoStats.matched === 0 || busy !== null}
              onClick={() => {
                setApplyResult(null);
                setApplyAll(true);
              }}
            >
              <Icon name="sync_alt" size={14} /> Apply Gusto to all matched
            </button>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
            <tr>
              <th className="w-10 px-4 py-2" />
              <th className="px-4 py-2 text-left font-medium whitespace-nowrap sticky left-10 bg-[var(--color-surface-container-low)]">Person</th>
              <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Created</th>
              {columns.map((f) => (
                <th key={f.key} className="px-4 py-2 text-left font-medium whitespace-nowrap">{f.label}</th>
              ))}
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const checked = selected.has(p.id);
              const match = gusto?.matches[p.id] ?? null;
              return (
                <Fragment key={p.id}>
                  <tr className={cn("border-t border-[var(--color-border)]", checked && "bg-[var(--color-accent)]/5")}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]" aria-label={`Select ${p.firstName} ${p.lastName}`} />
                    </td>
                    <td className={cn("px-4 py-2 whitespace-nowrap sticky left-10 bg-[var(--color-surface)]", checked && "bg-[var(--color-accent)]/5")}>
                      <Link href={`/people/${p.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                        {p.preferredName || p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(p.createdAt)}</td>
                    {columns.map((f) => {
                      const value = (p.data[f.key] ?? "").trim();
                      return (
                        <td key={f.key} className={cn("px-4 py-2 whitespace-nowrap max-w-[260px] truncate", value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]")} title={value || undefined}>
                          {value || "—"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right">
                      <button type="button" className={BUTTON.subtle} disabled={rowBusy === p.id || busy !== null} onClick={() => approveOne(p.id)}>
                        {rowBusy === p.id ? <Icon name="progress_activity" size={14} className="animate-material-spin" /> : <Icon name="how_to_reg" size={14} />}
                        Approve
                      </button>
                    </td>
                  </tr>
                  {gustoOn && (
                    <tr className="border-t border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)]/50">
                      <td colSpan={columns.length + 4} className="p-0">
                        {/* Sticks to the left of the scroll area so the diff is readable however wide the table is. */}
                        <div className="sticky left-0 flex w-fit max-w-[min(100%,56rem)] flex-wrap items-start gap-x-6 gap-y-2 px-4 py-2.5">
                          <div className="flex w-44 shrink-0 flex-wrap items-center gap-1.5 text-xs">
                            <Icon name="sync_alt" size={14} className="text-[var(--color-accent)]" />
                            <span className="font-medium text-[var(--color-text-primary)]">Gusto</span>
                            {match && <GustoMatchChip matchedBy={match.matchedBy} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {!gusto ? (
                              <span className="text-xs text-[var(--color-text-muted)]">{gustoLoading ? "Checking…" : "—"}</span>
                            ) : (
                              <>
                                {match && match.gustoName && (
                                  <p className="mb-0.5 text-xs text-[var(--color-text-muted)]">{match.gustoName}</p>
                                )}
                                <GustoDiff match={match} />
                              </>
                            )}
                          </div>
                          {match && match.changes.length > 0 && <GustoApplyButton employeeId={p.id} disabled={busy !== null} />}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmDelete} onClose={() => busy === null && setConfirmDelete(false)} title="Delete pending people?">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-primary)]">
            This permanently deletes <strong>{targetLabel}</strong> pending {targets.length === 1 ? "person" : "people"}. They have no login and nothing else attached, so nothing else is affected.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">This cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={BUTTON.subtle} disabled={busy !== null} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button type="button" className={BUTTON.danger} disabled={busy !== null} onClick={() => run("delete", () => deletePendingEmployees(targets))}>
              {busy === "delete" ? "Deleting…" : `Yes, delete ${targetLabel}`}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={applyAll} onClose={() => busy === null && setApplyAll(false)} title="Apply Gusto to all matched?">
        <div className="space-y-4">
          {applyResult ? (
            <>
              <p className="text-sm text-[var(--color-text-primary)]">
                Done. <strong>{applyResult.applied.length}</strong> updated · {applyResult.unmatched.length} unmatched · {applyResult.failed.length} failed.
              </p>
              {applyResult.failed.length > 0 && (
                <ul className="space-y-0.5 text-xs text-red-500">
                  {applyResult.failed.map((f) => (
                    <li key={f.id}>
                      <strong>{nameOf(f.id)}</strong>: {f.error}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end pt-2">
                <button type="button" className={BUTTON.subtle} onClick={() => setApplyAll(false)}>Close</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-primary)]">
                Writes what Gusto has for <strong>{gustoStats?.matched ?? 0}</strong> matched {gustoStats?.matched === 1 ? "person" : "people"};{" "}
                <strong>{gustoStats?.withChanges ?? 0}</strong> currently differ. People with no match are left alone, and everyone
                applied is linked to their Gusto record.
              </p>
              <div className="space-y-1.5">
                <GustoStrategyPicker value={applyStrategy} onChange={setApplyStrategy} disabled={busy !== null} />
                <p className="text-xs text-[var(--color-text-muted)]">{STRATEGY_HINT[applyStrategy]}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={BUTTON.subtle} disabled={busy !== null} onClick={() => setApplyAll(false)}>Cancel</button>
                <button type="button" className={BUTTON.accent} disabled={busy !== null || !gustoStats || gustoStats.matched === 0} onClick={runApplyAll}>
                  {busy === "gusto" ? (
                    <>
                      <Icon name="progress_activity" size={14} className="animate-material-spin" /> Applying…
                    </>
                  ) : (
                    `Apply to ${gustoStats?.matched ?? 0} ${gustoStats?.matched === 1 ? "person" : "people"}`
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
