"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import {
  commitImport,
  type ImportBatchDetail,
  type ImportRowView,
} from "@/lib/actions/imports";
import type { CommitResult, CommitSummary } from "@/lib/import-export/types";
import { BUTTON, Chip, rowBadge, rowDisplayName, type Badge } from "./row-editor";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  PRE_ONBOARDING: "Written Offer",
  TRAINING: "Training",
  ONBOARDING: "Onboarding",
  OFFBOARDED: "Offboarded",
};

const RESULT_BADGE: Record<CommitResult, Badge> = {
  created: { label: "Created", className: "bg-emerald-500/10 text-emerald-600" },
  updated: { label: "Updated", className: "bg-blue-500/10 text-blue-600" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-500" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ImportStep({ detail, onBack }: { detail: ImportBatchDetail; onBack: () => void }) {
  if (detail.batch.status === "IMPORTED") return <ImportResults detail={detail} />;
  if (detail.batch.status === "DISCARDED") {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        This import was discarded — nothing was saved to the system.
      </p>
    );
  }
  return <ImportPreview detail={detail} onBack={onBack} />;
}

// ---------------------------------------------------------------------------
// Before committing
// ---------------------------------------------------------------------------

type Effects = {
  /** Created as Pending: no login, no email. Rows without an email land here whatever their status says. */
  pending: number;
  /** Created with another status: login + welcome email. */
  invited: { status: string; count: number }[];
  invitedTotal: number;
  updates: number;
};

function computeEffects(rows: ImportRowView[]): Effects {
  let pending = 0;
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    if (r.action !== "CREATE") continue;
    const status = r.data.status ?? "PENDING";
    if (status === "PENDING" || !r.data.email) pending++;
    else byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const invited = Array.from(byStatus, ([status, count]) => ({ status, count }));
  return {
    pending,
    invited,
    invitedTotal: invited.reduce((n, i) => n + i.count, 0),
    updates: rows.filter((r) => r.action === "UPDATE").length,
  };
}

function EffectLine({ icon, children, muted }: { icon: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <li className={cn("flex items-start gap-2", muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>
      <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
      <span>{children}</span>
    </li>
  );
}

function EffectsList({ effects, compact }: { effects: Effects; compact?: boolean }) {
  const statusList = effects.invited
    .map((i) => `${i.count} as ${STATUS_LABELS[i.status] ?? i.status}`)
    .join(", ");
  return (
    <ul className={cn("space-y-2", compact ? "text-xs" : "text-sm")}>
      {effects.pending > 0 && (
        <EffectLine icon="person_add">
          <strong>{plural(effects.pending, "person", "people")}</strong> created as <strong>Pending</strong> — no login, no
          email. Approve and invite them later from People.
        </EffectLine>
      )}
      {effects.invitedTotal > 0 && (
        <EffectLine icon="mail">
          <strong>{plural(effects.invitedTotal, "person", "people")}</strong> created with a status ({statusList}) — they
          get a login and the welcome email, exactly like “Approve &amp; invite”.
        </EffectLine>
      )}
      {effects.updates > 0 && (
        <EffectLine icon="sync_alt">
          <strong>{plural(effects.updates, "existing person", "existing people")}</strong> updated — only the columns in the
          file change, blanks never overwrite, and status is never changed.
        </EffectLine>
      )}
      {!compact && (
        <>
          <EffectLine icon="account_tree" muted>
            Departments and teams named in the file are created when they don’t exist yet.
          </EffectLine>
          <EffectLine icon="supervisor_account" muted>
            Managers are linked by email or name once everyone exists; rows we can’t match get a warning.
          </EffectLine>
        </>
      )}
    </ul>
  );
}

function ImportPreview({ detail, onBack }: { detail: ImportBatchDetail; onBack: () => void }) {
  const router = useRouter();
  const s = detail.stats;
  const effects = useMemo(() => computeEffects(detail.rows), [detail.rows]);
  const blocked = s.needsDecision > 0 || s.needsAttention > 0;
  const nothing = s.newPeople + s.updates === 0;
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tiles = [
    { label: "New people", value: s.newPeople, icon: "person_add" },
    { label: "Updates to existing", value: s.updates, icon: "sync_alt" },
    { label: "Merged into another row", value: s.mergedAway, icon: "merge" },
    { label: "Skipped", value: s.skipped, icon: "block" },
  ];

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await commitImport(detail.batch.id);
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Tiles tiles={tiles} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">What happens when you import</h3>
        {nothing ? (
          <p className="text-sm text-[var(--color-text-muted)]">Every row is skipped or merged away — there is nothing to import.</p>
        ) : (
          <EffectsList effects={effects} />
        )}
      </div>

      {blocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
          <Icon name="warning" size={14} />
          <span>
            {s.needsDecision > 0 && `${plural(s.needsDecision, "duplicate group")} still need${s.needsDecision === 1 ? "s" : ""} a decision. `}
            {s.needsAttention > 0 && `${plural(s.needsAttention, "row")} ${s.needsAttention === 1 ? "has" : "have"} errors to fix or skip.`}
          </span>
          <button type="button" onClick={onBack} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2.5 py-1 font-medium hover:bg-amber-500/10">
            <Icon name="arrow_back" size={14} /> Back to Review
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {!blocked && !nothing && (
          <span className="text-xs text-[var(--color-text-muted)]">This can’t be undone — use Archive on a person to reverse a mistake.</span>
        )}
        <button type="button" className={BUTTON.primary} disabled={blocked || nothing || pending} onClick={() => setConfirming(true)}>
          <Icon name="upload" size={14} /> Import
        </button>
      </div>

      <Dialog open={confirming} onClose={() => !pending && setConfirming(false)} title={`Import ${detail.batch.fileName}?`}>
        <div className="space-y-4">
          <EffectsList effects={effects} compact />
          <p className="text-xs text-[var(--color-text-muted)]">
            Welcome emails go out immediately. There is no undo for an import — archive or delete a person to reverse a
            mistake.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BUTTON.secondary} onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </button>
            <button type="button" className={BUTTON.primary} onClick={confirm} disabled={pending}>
              {pending ? (
                <>
                  <Icon name="progress_activity" size={14} className="animate-material-spin" /> Importing…
                </>
              ) : (
                <>
                  <Icon name="upload" size={14} /> Import now
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// After committing
// ---------------------------------------------------------------------------

function summaryFromRows(rows: ImportRowView[]): CommitSummary {
  const summary: CommitSummary = { created: 0, updated: 0, failed: 0, warnings: 0, invited: 0 };
  for (const r of rows) {
    if (r.result === "created") summary.created++;
    else if (r.result === "updated") summary.updated++;
    else if (r.result === "failed") summary.failed++;
    if (r.result && r.result !== "failed") summary.warnings += r.resultNotes.length;
  }
  return summary;
}

function ImportResults({ detail }: { detail: ImportBatchDetail }) {
  const summary = detail.batch.summary ?? summaryFromRows(detail.rows);
  const imported = detail.rows.filter((r) => r.result !== null);
  const notImported = detail.rows.filter((r) => r.result === null);

  const tiles = [
    { label: "Created", value: summary.created, icon: "person_add" },
    { label: "Updated", value: summary.updated, icon: "sync_alt" },
    { label: "Failed", value: summary.failed, icon: "error", tone: summary.failed > 0 ? "bad" : undefined },
    { label: "Warnings", value: summary.warnings, icon: "warning", tone: summary.warnings > 0 ? "warn" : undefined },
    { label: "Invited", value: summary.invited, icon: "mail" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-[var(--color-text-primary)] inline-flex items-center gap-1.5">
          <Icon name="check_circle" size={18} className="text-emerald-600" />
          Imported{detail.batch.importedAt ? ` on ${formatDate(detail.batch.importedAt)}` : ""}.
        </p>
        <Link href="/people" className={BUTTON.primary}>
          <Icon name="group" size={14} /> Go to People
        </Link>
      </div>

      <Tiles tiles={tiles} columns={5} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
            <tr>
              <th className="px-4 py-2 text-right font-medium w-12">#</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Result</th>
              <th className="px-4 py-2 text-left font-medium">Notes</th>
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {imported.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">No rows were imported.</td>
              </tr>
            )}
            {imported.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)] tabular-nums">{r.rowNumber}</td>
                <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                  {rowDisplayName(r.data) || <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
                <td className="px-4 py-2.5">{r.result && <Chip badge={RESULT_BADGE[r.result]} />}</td>
                <td className="px-4 py-2.5 text-xs">
                  {r.resultNotes.length === 0 ? (
                    <span className="text-[var(--color-text-muted)]">—</span>
                  ) : (
                    <ul className={cn("space-y-0.5", r.result === "failed" ? "text-red-500" : "text-amber-600")}>
                      {r.resultNotes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.resultEmployeeId && (
                    <Link
                      href={`/people/${r.resultEmployeeId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline whitespace-nowrap"
                    >
                      Open <Icon name="open_in_new" size={12} />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notImported.length > 0 && (
        <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
            Not imported ({notImported.length})
          </summary>
          <div className="border-t border-[var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {notImported.map((r) => (
                  <tr key={r.id} className="border-t first:border-t-0 border-[var(--color-border)]">
                    <td className="px-4 py-2 text-right text-[var(--color-text-muted)] tabular-nums w-12">{r.rowNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{rowDisplayName(r.data) || <span className="text-[var(--color-text-muted)]">—</span>}</td>
                    <td className="px-4 py-2"><Chip badge={rowBadge(r)} /></td>
                    <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">
                      {r.action === "MERGED_AWAY"
                        ? "Merged into another row"
                        : r.skipReason === "invalid"
                          ? r.errors.map((e) => e.message).join("; ")
                          : "Skipped during review"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

type Tile = { label: string; value: number; icon: string; tone?: "warn" | "bad" };

function Tiles({ tiles, columns = 4 }: { tiles: readonly Tile[]; columns?: 4 | 5 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", columns === 5 ? "md:grid-cols-5" : "md:grid-cols-4")}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Icon name={t.icon} size={14} />
            {t.label}
          </div>
          <p
            className={cn(
              "text-2xl font-bold mt-1",
              t.tone === "bad" ? "text-red-500" : t.tone === "warn" ? "text-amber-600" : "text-[var(--color-text-primary)]",
            )}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}
