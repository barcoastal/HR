"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  resolveGroupMerge,
  resolveGroupSeparate,
  undoGroupDecision,
  type ImportBatchDetail,
  type ImportGroupView,
  type ImportRowView,
} from "@/lib/actions/imports";
import { refKey } from "@/lib/import-export/types";
import { BUTTON, rowBadge, rowDisplayName } from "./row-editor";
import { CompareTable, Note, TableFooter, employeeMember, useMergeState, type PanelMember } from "./compare-table";

/** Import-review wrapper around `CompareTable`: file rows vs. existing people, with merge / keep separate / undo. */

type Run = (fn: () => Promise<void>) => void;

type Props = {
  detail: ImportBatchDetail;
  group: ImportGroupView;
  readOnly: boolean;
  busy: boolean;
  run: Run;
  onSkipRow: (rowId: string) => void;
};

type ImportMember = PanelMember & { row?: ImportRowView };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Existing employees first, then rows by row number. */
function compareMembers(a: ImportMember, b: ImportMember): number {
  if (a.ref.kind !== b.ref.kind) return a.ref.kind === "employee" ? -1 : 1;
  return (a.rowNumber ?? 0) - (b.rowNumber ?? 0);
}

function buildMembers(detail: ImportBatchDetail, group: ImportGroupView): ImportMember[] {
  const rowById = new Map(detail.rows.map((r) => [r.id, r]));
  const members: ImportMember[] = [];
  for (const ref of group.members) {
    if (ref.kind === "row") {
      const row = rowById.get(ref.id);
      if (!row) continue;
      members.push({
        ref,
        key: refKey(ref),
        row,
        rowNumber: row.rowNumber,
        data: row.data,
        label: `Row ${row.rowNumber} in file`,
        name: rowDisplayName(row.data) || "(no name)",
        badges: [rowBadge(row)],
        live: row.action === "CREATE" || row.action === "UPDATE",
      });
    } else {
      members.push(employeeMember(ref, detail.employees[ref.id]));
    }
  }
  return members.sort(compareMembers);
}

/** Employee.email is unique, so two live members with the exact same email can't both be imported. */
function sharedExactEmail(live: PanelMember[]): boolean {
  const emails = live.map((m) => (m.data.email ?? "").trim().toLowerCase()).filter(Boolean);
  return new Set(emails).size !== emails.length;
}

function mergedNote(detail: ImportBatchDetail, group: ImportGroupView, members: ImportMember[]): string {
  const carrier = members.find((m) => m.row && (m.row.action === "CREATE" || m.row.action === "UPDATE"));
  const rowText = carrier ? `Row ${carrier.rowNumber}` : "one row";
  const targetId = group.primary?.kind === "employee" ? group.primary.id : carrier?.row?.targetEmployeeId;
  const target = targetId ? detail.employees[targetId]?.name : undefined;
  return target ? `Merged into ${rowText} as an update to ${target}.` : `Merged into ${rowText} as a new person.`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparePanel({ detail, group, readOnly, busy, run, onSkipRow }: Props) {
  const members = useMemo(() => buildMembers(detail, group), [detail, group]);
  const liveMembers = members.filter((m) => m.live);
  const liveEmployeeCount = liveMembers.filter((m) => m.ref.kind === "employee").length;
  const canDecide = !readOnly && group.status === "PENDING" && liveMembers.length >= 2;
  const merge = useMergeState(liveMembers, canDecide);
  const memberByKey = new Map(members.map((m) => [m.key, m]));

  function confirmMerge() {
    if (!merge.primary) return;
    const primary = merge.primary;
    run(() => resolveGroupMerge(detail.batch.id, group.id, primary, merge.choices, merge.overrides));
    merge.cancel();
  }

  return (
    <CompareTable
      members={members}
      groupId={group.id}
      reasons={group.reasons}
      busy={busy}
      merging={merge.merging}
      primary={merge.primary}
      choices={merge.choices}
      overrides={merge.overrides}
      onChoosePrimary={merge.choosePrimary}
      onChooseField={merge.chooseField}
      onEdit={merge.edit}
      onReset={merge.reset}
      memberExtra={(m) => {
        const row = memberByKey.get(m.key)?.row;
        const showSkip = !readOnly && !merge.merging && group.status === "PENDING" && m.live && !!row;
        if (!showSkip || !row) return null;
        return (
          <button type="button" onClick={() => onSkipRow(row.id)} disabled={busy} className={cn(BUTTON.subtle, "mt-2 hover:text-red-500")}>
            <Icon name="block" size={12} /> Skip this row
          </button>
        );
      }}
      footer={
        <PanelFooter
          detail={detail}
          group={group}
          members={members}
          liveMembers={liveMembers}
          liveEmployeeCount={liveEmployeeCount}
          readOnly={readOnly}
          busy={busy}
          canDecide={canDecide}
          merging={merge.merging}
          run={run}
          onMerge={merge.enter}
          onCancel={merge.cancel}
          onConfirm={confirmMerge}
        />
      }
    />
  );
}

function PanelFooter({
  detail,
  group,
  members,
  liveMembers,
  liveEmployeeCount,
  readOnly,
  busy,
  canDecide,
  merging,
  run,
  onMerge,
  onCancel,
  onConfirm,
}: {
  detail: ImportBatchDetail;
  group: ImportGroupView;
  members: ImportMember[];
  liveMembers: PanelMember[];
  liveEmployeeCount: number;
  readOnly: boolean;
  busy: boolean;
  canDecide: boolean;
  merging: boolean;
  run: Run;
  onMerge: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const decisionNote =
    group.status === "MERGED" ? mergedNote(detail, group, members) : group.status === "SEPARATE" ? "Kept as separate people." : null;
  const nothingLeft = !readOnly && group.status === "PENDING" && liveMembers.length < 2;
  const emailClash = canDecide && sharedExactEmail(liveMembers);

  const showExistingNote = liveEmployeeCount >= 2;
  if (!decisionNote && !nothingLeft && !canDecide && !showExistingNote) return null;

  return (
    <TableFooter>
      {showExistingNote && (
        <Note icon="info">
          Two existing people look alike — merging existing records isn’t supported here; pick one as the primary and the other stays untouched.
        </Note>
      )}

      {decisionNote && (
        <div className="flex flex-wrap items-center gap-3">
          <Note icon={group.status === "MERGED" ? "call_merge" : "call_split"}>{decisionNote}</Note>
          {!readOnly && (
            <button
              type="button"
              className={BUTTON.secondary}
              disabled={busy}
              onClick={() => run(() => undoGroupDecision(detail.batch.id, group.id))}
            >
              <Icon name="undo" size={14} /> Undo
            </button>
          )}
        </div>
      )}

      {nothingLeft && (
        <Note icon="check_circle">Nothing left to decide — fewer than two of these records are still being imported.</Note>
      )}

      {canDecide && !merging && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON.primary} disabled={busy} onClick={onMerge}>
            <Icon name="call_merge" size={14} /> Merge into one
          </button>
          <button
            type="button"
            className={BUTTON.secondary}
            disabled={busy || emailClash}
            onClick={() => run(() => resolveGroupSeparate(detail.batch.id, group.id))}
          >
            <Icon name="call_split" size={14} /> Keep separate
          </button>
          {emailClash && (
            <span className="basis-full">
              <Note icon="warning" tone="warn">
                These records share the same email, so they can’t both be imported — fix the email or merge.
              </Note>
            </span>
          )}
        </div>
      )}

      {merging && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON.secondary} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={BUTTON.primary} disabled={busy} onClick={onConfirm}>
            <Icon name="check" size={14} /> Confirm merge
          </button>
        </div>
      )}
    </TableFooter>
  );
}
