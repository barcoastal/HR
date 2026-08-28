"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import {
  commitImport,
  undoImport,
  type ImportBatchDetail,
  type ImportRowView,
} from "@/lib/actions/imports";
import { EMPLOYEE_FIELDS } from "@/lib/import-export/employee-fields";
import { UNDO_NOTE_PREFIX, type CommitResult, type CommitSummary, type FieldDef, type FieldKey, type RowData } from "@/lib/import-export/types";
import { BUTTON, Chip, rowBadge, rowDisplayName, type Badge } from "./row-editor";

const DANGER_BUTTON = {
  outline:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-red-500/50 text-red-600 hover:bg-red-500/10 disabled:opacity-50 disabled:pointer-events-none transition-colors",
  solid:
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition-colors",
};

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
  if (detail.batch.status === "IMPORTED" || detail.batch.status === "UNDONE") return <ImportResults detail={detail} />;
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

// ---------------------------------------------------------------------------
// Per-person change list (what the commit will actually write)
// ---------------------------------------------------------------------------

type FieldChange = { key: FieldKey; label: string; from: string | null; to: string };
type PersonPlan = { rowId: string; rowNumber: number; employeeId: string; name: string; changes: FieldChange[] };
type ChangePlan = { changed: PersonPlan[]; unchanged: PersonPlan[]; created: ImportRowView[] };

/**
 * Values that the commit would treat as the same: departments/teams/managers resolve by
 * case-insensitive name, emails are lowercased, phones are compared by digits only.
 */
function comparable(field: FieldDef, value: string): string {
  const v = value.trim();
  switch (field.type) {
    case "relation":
    case "email":
      return v.toLowerCase();
    case "phone":
      return v.replace(/\D/g, "");
    default:
      return v;
  }
}

/**
 * Mirrors the commit rules for UPDATE rows: a field is written only when the row has a value, so
 * blanks never clear anything, and status is never touched. Rows whose values all match the
 * person already are reported separately.
 */
function computeChangePlan(detail: ImportBatchDetail): ChangePlan {
  const changed: PersonPlan[] = [];
  const unchanged: PersonPlan[] = [];
  const created: ImportRowView[] = [];
  for (const row of detail.rows) {
    if (row.action === "CREATE") {
      created.push(row);
      continue;
    }
    if (row.action !== "UPDATE" || !row.targetEmployeeId) continue;
    const snapshot = detail.employees[row.targetEmployeeId];
    const current: RowData = snapshot?.data ?? {};
    const changes: FieldChange[] = [];
    for (const field of EMPLOYEE_FIELDS) {
      if (field.key === "status") continue;
      const to = (row.data[field.key] ?? "").trim();
      if (!to) continue;
      const from = current[field.key] ?? null;
      if (from !== null && comparable(field, from) === comparable(field, to)) continue;
      changes.push({ key: field.key, label: field.label, from, to });
    }
    const plan: PersonPlan = {
      rowId: row.id,
      rowNumber: row.rowNumber,
      employeeId: row.targetEmployeeId,
      name: snapshot?.name || rowDisplayName(row.data) || `Row ${row.rowNumber}`,
      changes,
    };
    (changes.length > 0 ? changed : unchanged).push(plan);
  }
  return { changed, unchanged, created };
}

/** Sections start open unless they are long enough to bury the Import button. */
const OPEN_LIMIT = 25;

function ChangeSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details open={count <= OPEN_LIMIT} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)]">{title}</summary>
      <div className="border-t border-[var(--color-border)] px-3 py-2.5">{children}</div>
    </details>
  );
}

function PersonLink({ plan }: { plan: PersonPlan }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Link href={`/people/${plan.employeeId}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
        {plan.name}
      </Link>
      <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">row {plan.rowNumber}</span>
    </span>
  );
}

const Dot = () => <span className="text-[var(--color-text-muted)]" aria-hidden>·</span>;

function ChangesPreview({ plan }: { plan: ChangePlan }) {
  const { changed, unchanged, created } = plan;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">What will change</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Only the fields listed here are written. Blank cells never clear a value, status is never changed, and an email
          that is someone’s login is kept.
        </p>
      </div>

      {changed.length > 0 && (
        <ChangeSection title={`Updates to existing people (${changed.length})`} count={changed.length}>
          <ul className="divide-y divide-[var(--color-border)]">
            {changed.map((p) => (
              <li key={p.rowId} className="py-2.5 first:pt-0 last:pb-0">
                <PersonLink plan={p} />
                <ul className="mt-1 space-y-0.5 text-xs">
                  {p.changes.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-[var(--color-text-muted)]">{c.label}:</span>
                      {c.from ? (
                        <span className="text-[var(--color-text-muted)] line-through">{c.from}</span>
                      ) : (
                        <span className="italic text-[var(--color-text-muted)]">empty</span>
                      )}
                      <Icon name="arrow_forward" size={12} className="self-center text-[var(--color-text-muted)]" />
                      <span className="font-medium text-[var(--color-text-primary)]">{c.to}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </ChangeSection>
      )}

      {unchanged.length > 0 && (
        <ChangeSection title={`No changes (${unchanged.length})`} count={unchanged.length}>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            Every value in these rows already matches the person — importing leaves them as they are.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {unchanged.map((p) => (
              <li key={p.rowId}>
                <PersonLink plan={p} />
              </li>
            ))}
          </ul>
        </ChangeSection>
      )}

      {created.length > 0 && (
        <ChangeSection title={`New people (${created.length})`} count={created.length}>
          <ul className="space-y-1 text-xs">
            {created.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {rowDisplayName(r.data) || `Row ${r.rowNumber}`}
                </span>
                {r.data.email && (
                  <>
                    <Dot />
                    <span className="text-[var(--color-text-muted)]">{r.data.email}</span>
                  </>
                )}
                {r.data.jobTitle && (
                  <>
                    <Dot />
                    <span className="text-[var(--color-text-muted)]">{r.data.jobTitle}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </ChangeSection>
      )}
    </div>
  );
}

function ImportPreview({ detail, onBack }: { detail: ImportBatchDetail; onBack: () => void }) {
  const router = useRouter();
  const s = detail.stats;
  const effects = useMemo(() => computeEffects(detail.rows), [detail.rows]);
  const changePlan = useMemo(() => computeChangePlan(detail), [detail]);
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

      {!nothing && <ChangesPreview plan={changePlan} />}

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
          <span className="text-xs text-[var(--color-text-muted)]">You can undo the import afterwards from this page.</span>
        )}
        <button type="button" className={BUTTON.primary} disabled={blocked || nothing || pending} onClick={() => setConfirming(true)}>
          <Icon name="upload" size={14} /> Import
        </button>
      </div>

      <Dialog open={confirming} onClose={() => !pending && setConfirming(false)} title={`Import ${detail.batch.fileName}?`}>
        <div className="space-y-4">
          <EffectsList effects={effects} compact />
          <p className="text-xs text-[var(--color-text-muted)]">
            Welcome emails go out immediately and can’t be recalled. You can undo the import afterwards — that deletes the
            people it created and puts updated people back.
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

/** Undo outcomes live in the same notes array as import warnings, marked by a prefix. */
function splitNotes(notes: string[]) {
  const importNotes: string[] = [];
  const undoNotes: string[] = [];
  for (const n of notes) {
    if (n.startsWith(UNDO_NOTE_PREFIX)) undoNotes.push(n.slice(UNDO_NOTE_PREFIX.length));
    else importNotes.push(n);
  }
  return { importNotes, undoNotes };
}

function ImportResults({ detail }: { detail: ImportBatchDetail }) {
  const router = useRouter();
  const summary = detail.batch.summary ?? summaryFromRows(detail.rows);
  const undone = detail.batch.status === "UNDONE";
  const undo = summary.undo ?? null;
  const orgCreated = (summary.createdDepartmentIds?.length ?? 0) + (summary.createdTeamIds?.length ?? 0);
  const imported = detail.rows.filter((r) => r.result !== null);
  const notImported = detail.rows.filter((r) => r.result === null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmUndo() {
    setError(null);
    startTransition(async () => {
      try {
        await undoImport(detail.batch.id);
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

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
        {undone ? (
          <p className="text-sm text-[var(--color-text-primary)] inline-flex items-center gap-1.5">
            <Icon name="undo" size={18} className="text-[var(--color-text-muted)]" />
            Undone{detail.batch.undoneAt ? ` on ${formatDate(detail.batch.undoneAt)}` : ""}
            {detail.batch.importedAt ? ` — originally imported on ${formatDate(detail.batch.importedAt)}` : ""}.
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-primary)] inline-flex items-center gap-1.5">
            <Icon name="check_circle" size={18} className="text-emerald-600" />
            Imported{detail.batch.importedAt ? ` on ${formatDate(detail.batch.importedAt)}` : ""}.
          </p>
        )}
        <div className="flex items-center gap-2">
          {!undone && (
            <button type="button" className={DANGER_BUTTON.outline} onClick={() => setConfirming(true)} disabled={pending}>
              <Icon name="undo" size={14} /> Undo this import
            </button>
          )}
          <Link href="/people" className={BUTTON.primary}>
            <Icon name="group" size={14} /> Go to People
          </Link>
        </div>
      </div>

      {undone && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-4 text-sm">
          <p className="font-semibold text-[var(--color-text-primary)] mb-2">This import was undone</p>
          {undo ? (
            <ul className="space-y-1 text-[var(--color-text-secondary)]">
              <EffectLine icon="person_remove">
                <strong>{plural(undo.deleted, "person", "people")}</strong> deleted, along with the logins this import made.
              </EffectLine>
              <EffectLine icon="history">
                <strong>{plural(undo.restored, "update")}</strong> reverted to the pre-import values.
              </EffectLine>
              {undo.skipped > 0 && (
                <EffectLine icon="block">
                  <strong>{plural(undo.skipped, "row")}</strong> skipped — see the notes on each row below.
                </EffectLine>
              )}
              <EffectLine icon="account_tree" muted>
                {plural(undo.departmentsRemoved, "department")} and {plural(undo.teamsRemoved, "team")} it created were removed
                because nothing used them any more.
              </EffectLine>
            </ul>
          ) : (
            <p className="text-[var(--color-text-muted)]">The people it created were deleted and the people it updated were put back.</p>
          )}
        </div>
      )}

      <Tiles tiles={tiles} columns={5} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
            <tr>
              <th className="px-4 py-2 text-right font-medium w-12">#</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Result</th>
              <th className="px-4 py-2 text-left font-medium">Notes</th>
              {undone && <th className="px-4 py-2 text-left font-medium">Undo</th>}
              <th className="px-4 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {imported.length === 0 && (
              <tr>
                <td colSpan={undone ? 6 : 5} className="px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">No rows were imported.</td>
              </tr>
            )}
            {imported.map((r) => {
              const { importNotes, undoNotes } = splitNotes(r.resultNotes);
              // Created people are gone once undone (or archived/merged, which is noted); updated people still exist.
              const canOpen = !!r.resultEmployeeId && !(undone && r.result === "created");
              return (
                <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)] tabular-nums">{r.rowNumber}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                    {rowDisplayName(r.data) || <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5">{r.result && <Chip badge={RESULT_BADGE[r.result]} />}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {importNotes.length === 0 ? (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    ) : (
                      <ul className={cn("space-y-0.5", r.result === "failed" ? "text-red-500" : "text-amber-600")}>
                        {importNotes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  {undone && (
                    <td className="px-4 py-2.5 text-xs">
                      {undoNotes.length === 0 ? (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      ) : (
                        <ul className="space-y-0.5 text-[var(--color-text-secondary)]">
                          {undoNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    {canOpen && (
                      <Link
                        href={`/people/${r.resultEmployeeId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline whitespace-nowrap"
                      >
                        Open <Icon name="open_in_new" size={12} />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
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

      <Dialog open={confirming} onClose={() => !pending && setConfirming(false)} title={`Undo ${detail.batch.fileName}?`}>
        <div className="space-y-4">
          <ul className="space-y-2 text-sm">
            <EffectLine icon="person_remove">
              Deletes <strong>{plural(summary.created, "person", "people")}</strong> created by this import (and their logins) —
              including anyone approved or edited since.
            </EffectLine>
            <EffectLine icon="history">
              Reverts <strong>{plural(summary.updated, "update")}</strong> to the values from before the import.
            </EffectLine>
            <EffectLine icon="account_tree">
              Removes <strong>{plural(orgCreated, "department/team", "departments/teams")}</strong> it created if empty.
            </EffectLine>
          </ul>
          <p className="text-xs text-[var(--color-text-muted)]">
            People archived or deleted since the import are left alone. This cannot be undone.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BUTTON.secondary} onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </button>
            <button type="button" className={DANGER_BUTTON.solid} onClick={confirmUndo} disabled={pending}>
              {pending ? (
                <>
                  <Icon name="progress_activity" size={14} className="animate-material-spin" /> Undoing…
                </>
              ) : (
                <>
                  <Icon name="undo" size={14} /> Undo import
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
