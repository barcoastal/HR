"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import {
  autoMergeMatches,
  skipImportRow,
  skipInvalidRows,
  unskipImportRow,
  type ImportBatchDetail,
  type ImportGroupView,
  type ImportRowView,
} from "@/lib/actions/imports";
import type { MemberRef } from "@/lib/import-export/types";
import { ComparePanel } from "./compare-panel";
import { Chip, RowEditor, rowBadge, rowDisplayName } from "./row-editor";

type Selection = { kind: "group"; id: string } | { kind: "row"; id: string } | null;
type Tab = "groups" | "rows";

const REASON_LABEL: Record<string, string> = { email: "Same email", phone: "Same phone", name: "Same name" };

function groupStatusLabel(group: ImportGroupView, needsDecision: boolean): { label: string; className: string } {
  if (needsDecision) return { label: "Needs decision", className: "text-amber-600" };
  if (group.status === "MERGED") return { label: "Merged", className: "text-purple-600" };
  if (group.status === "SEPARATE") return { label: "Kept separate", className: "text-[var(--color-text-muted)]" };
  return { label: "Resolved", className: "text-[var(--color-text-muted)]" };
}

export function ReviewStep({ detail, onContinue }: { detail: ImportBatchDetail; onContinue: () => void }) {
  const router = useRouter();
  const readOnly = detail.batch.status !== "REVIEWING";
  const rowById = useMemo(() => new Map(detail.rows.map((r) => [r.id, r])), [detail.rows]);

  const isLive = (m: MemberRef) =>
    m.kind === "employee" ? !!detail.employees[m.id] : ["CREATE", "UPDATE"].includes(rowById.get(m.id)?.action ?? "");
  const needsDecision = (g: ImportGroupView) => g.status === "PENDING" && g.members.filter(isLive).length >= 2;
  // Groups the bulk action can settle: one existing person + at least one file row.
  const autoMergeable = detail.groups.filter((g) => {
    if (!needsDecision(g)) return false;
    const live = g.members.filter(isLive);
    return live.filter((m) => m.kind === "employee").length === 1 && live.some((m) => m.kind === "row");
  }).length;

  const [tab, setTab] = useState<Tab>("groups");
  const [selection, setSelection] = useState<Selection>(() => {
    const first = detail.groups.find(needsDecision) ?? detail.groups[0];
    return first ? { kind: "group", id: first.id } : null;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [strategy, setStrategy] = useState<"fill" | "overwrite">("fill");

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const memberLabel = (m: MemberRef) => {
    if (m.kind === "employee") return detail.employees[m.id]?.name ?? "Existing person";
    const r = rowById.get(m.id);
    return r ? rowDisplayName(r.data) || `Row ${r.rowNumber}` : "Row";
  };

  const selectedGroup = selection?.kind === "group" ? detail.groups.find((g) => g.id === selection.id) : undefined;
  const selectedRow = selection?.kind === "row" ? rowById.get(selection.id) : undefined;
  const s = detail.stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Stat icon="call_merge" label="need a decision" value={s.needsDecision} tone={s.needsDecision ? "warn" : "ok"} />
        <Stat icon="person_add" label="new people ready" value={s.newPeople} />
        <Stat icon="sync_alt" label="updates" value={s.updates} />
        <Stat icon="error" label="need attention" value={s.needsAttention} tone={s.needsAttention ? "warn" : undefined} />
        <Stat icon="block" label="skipped" value={s.skipped} />
        <span className="ml-auto flex items-center gap-2">
          {!readOnly && autoMergeable > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-1.5 font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 disabled:opacity-50"
            >
              <Icon name="call_merge" size={14} /> Merge all {autoMergeable} match{autoMergeable === 1 ? "" : "es"} into existing people
            </button>
          )}
          {!readOnly && s.needsAttention > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Skip all ${s.needsAttention} row${s.needsAttention === 1 ? "" : "s"} with errors? They won't be imported.`)) return;
                run(() => skipInvalidRows(detail.batch.id).then(() => undefined));
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            >
              <Icon name="block" size={14} /> Skip all rows with errors
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium",
              s.needsDecision === 0 && s.needsAttention === 0
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
            )}
          >
            Continue to Import <Icon name="arrow_forward" size={14} />
          </button>
        </span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      <Dialog open={bulkOpen} onClose={() => !pending && setBulkOpen(false)} title={`Merge ${autoMergeable} match${autoMergeable === 1 ? "" : "es"} into existing people?`}>
        <div className="space-y-4 text-sm">
          <p className="text-[var(--color-text-muted)]">
            Each file row that matches exactly one person already in the system becomes an update to that person. Groups with two file rows or more than one existing person are left for you to review by hand.
          </p>
          <div className="space-y-2">
            {([
              ["fill", "Keep what's already there, fill in the blanks from the file", "Safe default — existing values are never overwritten."],
              ["overwrite", "File values win", "Wherever the file has a value it replaces the existing one; blanks in the file leave the existing value alone."],
            ] as const).map(([value, label, hint]) => (
              <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", strategy === value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)]")}>
                <input type="radio" name="merge-strategy" value={value} checked={strategy === value} onChange={() => setStrategy(value)} className="mt-1 accent-[var(--color-accent)]" />
                <span>
                  <span className="block font-medium text-[var(--color-text-primary)]">{label}</span>
                  <span className="block text-xs text-[var(--color-text-muted)]">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Every merge can still be undone group by group before you import.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setBulkOpen(false)} disabled={pending} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setBulkOpen(false);
                run(() => autoMergeMatches(detail.batch.id, strategy).then(() => undefined));
              }}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              Merge {autoMergeable}
            </button>
          </div>
        </div>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="flex border-b border-[var(--color-border)] text-xs font-medium">
            {(["groups", "rows"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-3 py-2 transition-colors",
                  tab === t
                    ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                )}
              >
                {t === "groups" ? `Duplicates (${detail.groups.length})` : `All rows (${detail.rows.length})`}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {tab === "groups" &&
              (detail.groups.length === 0 ? (
                <p className="p-4 text-xs text-[var(--color-text-muted)]">No possible duplicates found.</p>
              ) : (
                detail.groups.map((g) => (
                  <GroupListItem
                    key={g.id}
                    group={g}
                    title={Array.from(new Set(g.members.map(memberLabel))).join(" · ")}
                    status={groupStatusLabel(g, needsDecision(g))}
                    active={selection?.kind === "group" && selection.id === g.id}
                    onSelect={() => setSelection({ kind: "group", id: g.id })}
                  />
                ))
              ))}
            {tab === "rows" &&
              detail.rows.map((r) => (
                <RowListItem
                  key={r.id}
                  row={r}
                  active={selection?.kind === "row" && selection.id === r.id}
                  onSelect={() => setSelection({ kind: "row", id: r.id })}
                />
              ))}
          </div>
        </div>

        <div className="min-w-0">
          {selectedGroup && (
            <ComparePanel
              key={selectedGroup.id}
              detail={detail}
              group={selectedGroup}
              readOnly={readOnly}
              busy={pending}
              run={run}
              onSkipRow={(id) => run(() => skipImportRow(detail.batch.id, id))}
            />
          )}
          {selectedRow && (
            <RowEditor
              key={selectedRow.id}
              batchId={detail.batch.id}
              row={selectedRow}
              readOnly={readOnly}
              busy={pending}
              run={run}
              onSkip={() => run(() => skipImportRow(detail.batch.id, selectedRow.id))}
              onUnskip={() => run(() => unskipImportRow(detail.batch.id, selectedRow.id))}
            />
          )}
          {!selectedGroup && !selectedRow && <EmptyHint detail={detail} />}
        </div>
      </div>
    </div>
  );
}

function GroupListItem({
  group,
  title,
  status,
  active,
  onSelect,
}: {
  group: ImportGroupView;
  title: string;
  status: { label: string; className: string };
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors",
        active && "bg-[var(--color-accent)]/5",
      )}
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {group.reasons.map((r) => (
          <span key={r} className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[10px] text-[var(--color-text-muted)]">
            {REASON_LABEL[r] ?? r}
          </span>
        ))}
        <span className={cn("ml-auto text-[10px] font-medium", status.className)}>{status.label}</span>
      </div>
    </button>
  );
}

function RowListItem({ row, active, onSelect }: { row: ImportRowView; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] flex items-center gap-3 transition-colors",
        active && "bg-[var(--color-accent)]/5",
      )}
    >
      <span className="text-[10px] text-[var(--color-text-muted)] w-8 shrink-0">#{row.rowNumber}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-[var(--color-text-primary)] truncate">{rowDisplayName(row.data) || "(no name)"}</span>
        <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{row.data.email ?? row.errors[0]?.message ?? ""}</span>
      </span>
      <Chip badge={rowBadge(row)} className="shrink-0" />
    </button>
  );
}

function EmptyHint({ detail }: { detail: ImportBatchDetail }) {
  let text = "Select a duplicate group or a row to see its details.";
  if (detail.groups.length === 0) {
    text =
      detail.stats.needsAttention > 0
        ? `No duplicates found. ${detail.stats.needsAttention} row${detail.stats.needsAttention === 1 ? "" : "s"} need attention — open All rows to fix them.`
        : "No duplicates to review. Head to the Import step.";
  }
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
      {text}
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]",
        tone === "warn" && "border-amber-500/40 text-amber-600",
        tone === "ok" && "border-emerald-500/40 text-emerald-600",
      )}
    >
      <Icon name={icon} size={14} />
      <strong>{value}</strong> {label}
    </span>
  );
}
