"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import {
  getBackgroundCheckDetail,
  refreshBackgroundCheck,
  refreshPendingBackgroundChecks,
  simulateBackgroundCheckResult,
} from "@/lib/actions/background-checks";
import { BACKGROUND_CHECK_STATUSES, BACKGROUND_CHECK_STATUS_LABELS } from "@/lib/background-checks/status";
import type {
  BackgroundCheckDetail,
  BackgroundCheckRow,
  BackgroundCheckStatus,
  ProviderInvitation,
  ProviderOrder,
} from "@/lib/background-checks/types";

type Filter = "ALL" | BackgroundCheckStatus;

// Colours follow the candidate dialog's background-check panel.
const STATUS_STYLE: Record<BackgroundCheckStatus, { chip: string; dot: string }> = {
  NOT_STARTED: { chip: "bg-slate-500/10 text-slate-600", dot: "bg-slate-400" },
  AWAITING_APPLICANT: { chip: "bg-yellow-500/10 text-yellow-700", dot: "bg-yellow-400 animate-pulse" },
  PENDING: { chip: "bg-orange-500/10 text-orange-700", dot: "bg-orange-400 animate-pulse" },
  PASSED: { chip: "bg-emerald-500/10 text-emerald-700", dot: "bg-green-500" },
  FAILED: { chip: "bg-red-500/10 text-red-700", dot: "bg-red-500" },
  ERROR: { chip: "bg-rose-500/10 text-rose-700", dot: "bg-rose-500" },
};

const TONE_STYLE = {
  muted: "bg-[var(--color-background)] text-[var(--color-text-muted)]",
  amber: "bg-amber-500/10 text-amber-700",
  red: "bg-red-500/10 text-red-700",
  emerald: "bg-emerald-500/10 text-emerald-700",
} as const;

const DELIVERY_FAILURES = ["FAILED", "BOUNCED", "SUPPRESSED", "COMPLAINED"];

function candidateHref(candidateId: string) {
  return `/cv?candidateId=${encodeURIComponent(candidateId)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function actionError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function fullName(row: BackgroundCheckRow) {
  return `${row.firstName} ${row.lastName}`;
}

type AdverseState = { label: string; detail: string | null; tone: keyof typeof TONE_STYLE };

function adverseActionState(row: BackgroundCheckRow): AdverseState | null {
  if (row.adverseActionLetterSentAt) {
    return { label: "Letter sent", detail: formatDate(row.adverseActionLetterSentAt), tone: "red" };
  }
  if (row.preAdverseActionSentAt) {
    if (row.preAdverseActionStatus && DELIVERY_FAILURES.includes(row.preAdverseActionStatus)) {
      return { label: "Notice not delivered", detail: row.preAdverseActionStatus.toLowerCase(), tone: "red" };
    }
    const due = row.preAdverseActionDueAt ? new Date(row.preAdverseActionDueAt) : null;
    if (due && due.getTime() <= Date.now()) {
      return { label: "Response period ended", detail: `ended ${formatDate(due)}`, tone: "amber" };
    }
    return {
      label: "Pre-adverse notice sent",
      detail: due ? `responses until ${formatDate(due)}` : formatDate(row.preAdverseActionSentAt),
      tone: "amber",
    };
  }
  if (row.preAdverseActionStatus === "FAILED") {
    return { label: "Notice failed to send", detail: null, tone: "red" };
  }
  if (row.status === "FAILED") {
    return { label: "Review required", detail: "no notice sent yet", tone: "muted" };
  }
  return null;
}

function StatusChip({ status, rawStatus }: { status: BackgroundCheckStatus; rawStatus?: string | null }) {
  const style = STATUS_STYLE[status];
  const label = BACKGROUND_CHECK_STATUS_LABELS[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", style.chip)}
      title={status === "ERROR" && rawStatus ? `Stored status: ${rawStatus}` : undefined}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", style.dot)} />
      {label}
    </span>
  );
}

// ── Refresh all pending (page header action) ───────────────

export function RefreshAllPendingButton({
  pendingCount,
  providerConfigured,
}: {
  pendingCount: number;
  providerConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await refreshPendingBackgroundChecks();
        const parts = [`${r.refreshed} refreshed`, `${r.changed} changed`];
        if (r.skipped > 0) parts.push(`${r.skipped} skipped`);
        if (r.errors.length > 0) parts.push(`${r.errors.length} error${r.errors.length === 1 ? "" : "s"}`);
        setResult({ tone: r.errors.length > 0 && r.refreshed === 0 ? "error" : "ok", text: parts.join(" · ") });
        router.refresh();
      } catch (err) {
        setResult({ tone: "error", text: actionError(err, "Refresh failed") });
      }
    });
  }

  const disabled = pending || pendingCount === 0 || !providerConfigured;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {result && (
        <span className={cn("text-xs", result.tone === "error" ? "text-red-600" : "text-[var(--color-text-muted)]")}>
          {result.text}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        title={
          !providerConfigured
            ? "Continental Screening is not configured on this server"
            : pendingCount === 0
              ? "No checks are waiting on the applicant or Continental"
              : "Re-fetch every awaiting / in-progress check from Continental"
        }
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Icon name={pending ? "progress_activity" : "sync"} size={16} className={pending ? "animate-material-spin" : undefined} />
        {pending ? "Refreshing…" : `Refresh all pending${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
      </button>
    </div>
  );
}

// ── List ───────────────────────────────────────────────────

export function BackgroundChecksView({
  rows: initialRows,
  isSuperAdmin,
  canViewReports,
  providerConfigured,
}: {
  rows: BackgroundCheckRow[];
  isSuperAdmin: boolean;
  canViewReports: boolean;
  providerConfigured: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Rows returned by refresh/simulate actions, layered over the server props
  // until the next router.refresh() delivers a fresh `rows` array.
  const [patch, setPatch] = useState<{ source: BackgroundCheckRow[]; rows: Record<string, BackgroundCheckRow> }>({
    source: initialRows,
    rows: {},
  });
  const overrides = patch.source === initialRows ? patch.rows : null;
  const rows = overrides ? initialRows.map((r) => overrides[r.candidateId] ?? r) : initialRows;

  function applyRow(row: BackgroundCheckRow) {
    setPatch((prev) => ({
      source: initialRows,
      rows: { ...(prev.source === initialRows ? prev.rows : {}), [row.candidateId]: row },
    }));
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      ALL: rows.length,
      NOT_STARTED: 0,
      AWAITING_APPLICANT: 0,
      PENDING: 0,
      PASSED: 0,
      FAILED: 0,
      ERROR: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "ALL" || r.status === filter) &&
        (!q || fullName(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    );
  }, [rows, filter, query]);

  const selected = selectedId ? rows.find((r) => r.candidateId === selectedId) ?? null : null;
  const filters: Filter[] = ["ALL", ...BACKGROUND_CHECK_STATUSES.filter((s) => s === "AWAITING_APPLICANT" || s === "PENDING" || s === "PASSED" || s === "FAILED" || counts[s] > 0)];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {f === "ALL" ? "All" : BACKGROUND_CHECK_STATUS_LABELS[f]}
                <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/20" : "bg-[var(--color-background)]")}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-72">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {visible.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Icon name="filter_alt_off" size={32} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No matching checks</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try another status filter or clear the search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className="bg-[var(--color-background)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-5 py-3 font-medium">Position</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                  <th className="px-5 py-3 font-medium">Last update</th>
                  <th className="px-5 py-3 font-medium">Report</th>
                  <th className="px-5 py-3 font-medium">Adverse action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/70">
                {visible.map((r) => {
                  const adverse = adverseActionState(r);
                  return (
                    <tr
                      key={r.candidateId}
                      onClick={() => setSelectedId(r.candidateId)}
                      className="cursor-pointer align-top hover:bg-[var(--color-surface-hover)]/50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={candidateHref(r.candidateId)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                        >
                          {fullName(r)}
                        </Link>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{r.email}</p>
                        {r.recruiterName && (
                          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">Recruiter: {r.recruiterName}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-text-primary)]">{r.positionTitle || "—"}</td>
                      <td className="px-5 py-4">
                        <StatusChip status={r.status} rawStatus={r.rawStatus} />
                        {r.isInvitation && (
                          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Invitation — no order yet</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-[var(--color-text-primary)]">
                        {r.sentAt ? formatDate(r.sentAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--color-text-muted)]" title={formatDateTime(r.updatedAt)}>
                        {timeAgo(r.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        {r.reportUrl ? (
                          canViewReports ? (
                            <a
                              href={r.reportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline whitespace-nowrap"
                            >
                              <Icon name="description" size={14} /> View PDF
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Admins only</span>
                          )
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {r.status === "PASSED" || r.status === "FAILED" ? "Not received" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {adverse ? (
                          <>
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", TONE_STYLE[adverse.tone])}>
                              {adverse.label}
                            </span>
                            {adverse.detail && <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{adverse.detail}</p>}
                          </>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-text-muted)]">
          Showing {visible.length.toLocaleString()} of {rows.length.toLocaleString()} check{rows.length === 1 ? "" : "s"} · click a row for Continental details
        </div>
      </section>

      {selected && (
        <DetailDialog
          key={selected.candidateId}
          row={selected}
          isSuperAdmin={isSuperAdmin}
          canViewReports={canViewReports}
          providerConfigured={providerConfigured}
          onClose={() => setSelectedId(null)}
          onRowUpdated={applyRow}
        />
      )}
    </div>
  );
}

// ── Detail dialog ──────────────────────────────────────────

function DetailDialog({
  row,
  isSuperAdmin,
  canViewReports,
  providerConfigured,
  onClose,
  onRowUpdated,
}: {
  row: BackgroundCheckRow;
  isSuperAdmin: boolean;
  canViewReports: boolean;
  providerConfigured: boolean;
  onClose: () => void;
  onRowUpdated: (row: BackgroundCheckRow) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<BackgroundCheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getBackgroundCheckDetail(row.candidateId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(actionError(err, "Could not load Continental details"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.candidateId, reloadKey]);

  const label = (status: BackgroundCheckStatus) => BACKGROUND_CHECK_STATUS_LABELS[status];

  function handleRefresh() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await refreshBackgroundCheck(row.candidateId);
        onRowUpdated(res.row);
        if (res.providerError) {
          setMessage({ tone: "error", text: res.providerError });
        } else if (res.changed) {
          setMessage({
            tone: "ok",
            text: `Updated: ${label(res.previousStatus)} → ${label(res.row.status)}${res.linkedOrderId ? ` · linked to Continental order ${res.linkedOrderId}` : ""}`,
          });
        } else {
          setMessage({
            tone: "ok",
            text: `Continental agrees — still ${label(res.row.status)}${res.linkedOrderId ? ` · linked to order ${res.linkedOrderId}` : ""}`,
          });
        }
        setReloadKey((k) => k + 1);
        router.refresh();
      } catch (err) {
        setMessage({ tone: "error", text: actionError(err, "Refresh failed") });
      }
    });
  }

  function handleSimulate(result: "PASSED" | "FAILED") {
    const resultLabel = result === "PASSED" ? "Passed — Clear" : "Flagged for Review";
    const ok = confirm(
      `TEST ACTION — simulate a "${resultLabel}" result for ${fullName(row)}?\n\n` +
        "This applies the result exactly as a Continental postback would: the candidate's check status changes and " +
        "the completion notifications go out to recruiters/HR. Nothing is sent to Continental. " +
        "The action is recorded in the audit log under your name.\n\nContinue?"
    );
    if (!ok) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await simulateBackgroundCheckResult(row.candidateId, result);
        onRowUpdated(res.row);
        setMessage({
          tone: "ok",
          text: res.changed
            ? `Test result applied: ${resultLabel}. Notifications fired as they would for a real result.`
            : `Check was already ${resultLabel} — nothing changed.`,
        });
        setReloadKey((k) => k + 1);
        router.refresh();
      } catch (err) {
        setMessage({ tone: "error", text: actionError(err, "Simulation failed") });
      }
    });
  }

  const checkLabel = row.checkId
    ? row.isInvitation
      ? `Invitation ${row.checkId.slice(4)}`
      : /^\d+$/.test(row.checkId)
        ? `Order ${row.checkId}`
        : row.checkId
    : null;

  return (
    <Dialog open onClose={onClose} title="Background check" className="max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{fullName(row)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {row.email}
              {row.positionTitle && <> · {row.positionTitle}</>}
              {row.recruiterName && <> · Recruiter: {row.recruiterName}</>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={row.status} rawStatus={row.rawStatus} />
              {checkLabel && (
                <span className="rounded-full bg-[var(--color-background)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-muted)]">
                  {checkLabel}
                </span>
              )}
              <Link
                href={candidateHref(row.candidateId)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                Open in Recruitment <Icon name="open_in_new" size={12} />
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={pending || !providerConfigured}
              title={!providerConfigured ? "Continental Screening is not configured on this server" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <Icon name={pending ? "progress_activity" : "sync"} size={14} className={pending ? "animate-material-spin" : undefined} />
              {pending ? "Working…" : "Refresh from Continental"}
            </button>
            {row.reportUrl && canViewReports && (
              <a
                href={row.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                <Icon name="description" size={14} /> View report PDF
              </a>
            )}
          </div>
        </div>

        {message && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              message.tone === "error" ? "bg-red-500/5 text-red-700" : "bg-emerald-500/5 text-emerald-700"
            )}
          >
            {message.text}
          </p>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Continental Screening</h3>
            {detail && !loading && (
              <span className="text-[10px] text-[var(--color-text-muted)]">as of {formatDateTime(detail.fetchedAt)}</span>
            )}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-text-muted)]">
              <Icon name="progress_activity" size={14} className="animate-material-spin" /> Fetching from Continental…
            </div>
          ) : loadError ? (
            <p className="rounded-lg bg-red-500/5 px-3 py-2 text-xs text-red-700">{loadError}</p>
          ) : detail ? (
            <>
              {!detail.providerConfigured && (
                <p className="rounded-lg bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                  Continental credentials are not configured on this server — showing stored data only.
                </p>
              )}
              {detail.providerNote && detail.providerConfigured && (
                <p className="rounded-lg bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-text-muted)]">{detail.providerNote}</p>
              )}
              {detail.providerError && (
                <p className="rounded-lg bg-red-500/5 px-3 py-2 text-xs text-red-700">
                  Continental request failed: {detail.providerError}
                </p>
              )}
              {detail.invitation && <InvitationCard invitation={detail.invitation} />}
              {detail.order && <OrderCard order={detail.order} />}
              {!detail.invitation && !detail.order && !detail.providerNote && !detail.providerError && detail.providerConfigured && (
                <p className="text-xs text-[var(--color-text-muted)]">Continental returned no data for this check.</p>
              )}
            </>
          ) : null}
        </section>

        <Timeline row={row} invitation={detail?.invitation ?? null} />

        {isSuperAdmin && (
          <section className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3 space-y-2">
            <p className="flex items-center gap-1 text-xs font-semibold text-amber-700">
              <Icon name="science" size={14} /> Testing tools — super admin only
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Simulate a Continental result to exercise the downstream flow (notifications, adverse-action workflow)
              without the vendor. No request is sent to Continental; every use is written to the audit log.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSimulate("PASSED")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Icon name="check_circle" size={12} /> Test: simulate Passed
              </button>
              <button
                type="button"
                onClick={() => handleSimulate("FAILED")}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Icon name="flag" size={12} /> Test: simulate Flagged
              </button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={cn("mt-0.5 text-xs text-[var(--color-text-primary)] truncate", mono && "font-mono")} title={value}>{value}</p>
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: ProviderInvitation }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[var(--color-text-primary)]">
        <Icon name="mail" size={14} className="text-[var(--color-text-muted)]" /> Invitation
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Status" value={invitation.status || "—"} />
        <Fact label="Created" value={formatDateTime(invitation.createdAt)} />
        <Fact label="Signed" value={invitation.signedAt ? formatDateTime(invitation.signedAt) : "Not signed yet"} />
        <Fact label="Order" value={invitation.orderId || "Not assigned yet"} mono={Boolean(invitation.orderId)} />
      </div>
      {invitation.applicantEmail && (
        <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">Sent to {invitation.applicantEmail}</p>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: ProviderOrder }) {
  const flaggedCount = order.searches.filter((s) => s.flagged).length;
  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
        <p className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-primary)]">
          <Icon name="fact_check" size={14} className="text-[var(--color-text-muted)]" /> Order{order.orderId ? ` ${order.orderId}` : ""}
        </p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-[var(--color-background)] px-2 py-0.5 text-[var(--color-text-muted)]">
            {order.status || "Unknown status"}
          </span>
          {order.searches.length > 0 && (
            <span className={cn("rounded-full px-2 py-0.5 font-medium", flaggedCount > 0 ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700")}>
              {flaggedCount > 0 ? `${flaggedCount} of ${order.searches.length} with records` : `${order.searches.length} searches, no records`}
            </span>
          )}
        </div>
      </div>
      {order.searches.length === 0 ? (
        <p className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No searches reported yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-[var(--color-background)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Search</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Records</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/70">
              {order.searches.map((s, i) => (
                <tr key={s.id ?? `${s.name}-${i}`} className={cn(s.flagged && "bg-red-500/5")}>
                  <td className="px-3 py-2 text-[var(--color-text-primary)]">{s.name}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.status || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={cn("font-medium", s.flagged ? "text-red-700" : "text-emerald-700")}>
                      {s.recordsFound ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-pre-wrap">{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type TimelineStep = { key: string; label: string; done: boolean; at: string | null; note?: string | null; tone?: "red" };

function Timeline({ row, invitation }: { row: BackgroundCheckRow; invitation: ProviderInvitation | null }) {
  const completed = row.status === "PASSED" || row.status === "FAILED";
  const signed = Boolean(invitation?.signedAt) || (!row.isInvitation && (row.status === "PENDING" || completed));
  const showAdverse = row.status === "FAILED" || Boolean(row.preAdverseActionSentAt) || Boolean(row.adverseActionLetterSentAt);

  const steps: TimelineStep[] = [
    { key: "sent", label: "Check sent to applicant", done: Boolean(row.sentAt), at: row.sentAt },
    {
      key: "signed",
      label: "Applicant completed the invitation",
      done: signed,
      at: invitation?.signedAt ?? null,
      note: !signed && row.status === "AWAITING_APPLICANT" ? "Waiting on the applicant" : null,
    },
    {
      key: "completed",
      label: completed ? `Completed — ${BACKGROUND_CHECK_STATUS_LABELS[row.status]}` : "Continental result",
      done: completed,
      at: row.reportImportedAt,
      note: completed ? (row.reportUrl ? "Report PDF on file" : "Report PDF not received yet") : row.status === "PENDING" ? "Searches in progress" : null,
      tone: row.status === "FAILED" ? "red" : undefined,
    },
  ];
  if (showAdverse) {
    steps.push(
      {
        key: "pre-adverse",
        label: "Pre-adverse action notice sent",
        done: Boolean(row.preAdverseActionSentAt),
        at: row.preAdverseActionSentAt,
        note: row.preAdverseActionDueAt ? `Response period ends ${formatDate(row.preAdverseActionDueAt)}` : null,
      },
      {
        key: "letter",
        label: "Adverse action letter sent",
        done: Boolean(row.adverseActionLetterSentAt),
        at: row.adverseActionLetterSentAt,
        tone: "red",
      }
    );
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Timeline</h3>
      <ol className="space-y-0">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[7px] top-4 bottom-0 w-px bg-[var(--color-border)]" aria-hidden />
            )}
            <span
              className={cn(
                "relative mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                step.done
                  ? step.tone === "red"
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-emerald-500 bg-emerald-500 text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              )}
            >
              {step.done && <Icon name="check" size={10} />}
            </span>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium", step.done ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]")}>
                {step.label}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {step.done ? (step.at ? formatDateTime(step.at) : "Done") : "Pending"}
                {step.note && <> · {step.note}</>}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
