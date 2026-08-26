"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
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
import { EMPLOYEE_FIELDS, FIELD_GROUPS } from "@/lib/import-export/employee-fields";
import { defaultFieldChoices } from "@/lib/import-export/merge";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/import-export/normalize";
import { refKey, sameRef, type FieldDef, type FieldKey, type MemberRef, type MergeMember } from "@/lib/import-export/types";
import { BUTTON, Chip, rowBadge, rowDisplayName, type Badge } from "./row-editor";

type Run = (fn: () => Promise<void>) => void;

type Props = {
  detail: ImportBatchDetail;
  group: ImportGroupView;
  readOnly: boolean;
  busy: boolean;
  run: Run;
  onSkipRow: (rowId: string) => void;
};

/** One column of the compare table. */
type PanelMember = MergeMember & {
  key: string;
  label: string;
  name: string;
  badges: Badge[];
  href?: string;
  live: boolean;
  row?: ImportRowView;
};

type FieldChoices = Partial<Record<FieldKey, MemberRef>>;
type Mode = "view" | "merge";

/** How the live members' values for one field relate to each other. */
type Tone = "conflict" | "same" | "partial" | "empty";

const REASON_LABEL: Record<string, string> = { email: "Same email", phone: "Same phone", name: "Same name" };
const ARCHIVED_BADGE: Badge = { label: "Archived", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" };
const MISSING_BADGE: Badge = { label: "No longer exists", className: "bg-red-500/10 text-red-500" };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): Badge {
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, "-");
  return { label, className: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" };
}

/** Existing employees first, then rows by row number. */
function compareMembers(a: PanelMember, b: PanelMember): number {
  if (a.ref.kind !== b.ref.kind) return a.ref.kind === "employee" ? -1 : 1;
  return (a.rowNumber ?? 0) - (b.rowNumber ?? 0);
}

function buildMembers(detail: ImportBatchDetail, group: ImportGroupView): PanelMember[] {
  const rowById = new Map(detail.rows.map((r) => [r.id, r]));
  const members: PanelMember[] = [];
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
      const employee = detail.employees[ref.id];
      members.push({
        ref,
        key: refKey(ref),
        data: employee?.data ?? {},
        label: "Already in system",
        name: employee?.name ?? "Unknown person",
        badges: employee ? [statusBadge(employee.status), ...(employee.archived ? [ARCHIVED_BADGE] : [])] : [MISSING_BADGE],
        href: employee ? `/people/${ref.id}` : undefined,
        live: !!employee,
      });
    }
  }
  return members.sort(compareMembers);
}

/** The existing employee if there is one, otherwise the first (lowest-numbered) live row. */
function defaultPrimary(live: PanelMember[]): MemberRef | null {
  return (live.find((m) => m.ref.kind === "employee") ?? live[0])?.ref ?? null;
}

function normalizeValue(field: FieldDef, value: string | undefined): string {
  const v = value?.trim() ?? "";
  if (!v) return "";
  if (field.type === "email") return normalizeEmail(v) || v.toLowerCase();
  if (field.type === "phone") return normalizePhone(v) || v.replace(/\D/g, "") || v.toLowerCase();
  return normalizeName(v) || v.toLowerCase();
}

function fieldTone(field: FieldDef, live: PanelMember[]): Tone {
  const values = live.map((m) => normalizeValue(field, m.data[field.key]));
  const filled = new Set(values.filter(Boolean));
  if (filled.size > 1) return "conflict";
  if (filled.size === 0) return "empty";
  return values.every(Boolean) ? "same" : "partial";
}

/** Employee.email is unique, so two live members with the exact same email can't both be imported. */
function sharedExactEmail(live: PanelMember[]): boolean {
  const emails = live.map((m) => (m.data.email ?? "").trim().toLowerCase()).filter(Boolean);
  return new Set(emails).size !== emails.length;
}

function mergedNote(detail: ImportBatchDetail, group: ImportGroupView, members: PanelMember[]): string {
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

  const [mode, setMode] = useState<Mode>("view");
  const [primary, setPrimary] = useState<MemberRef | null>(null);
  const [choices, setChoices] = useState<FieldChoices>({});

  // Merge mode only makes sense while a decision is still possible and the chosen primary is still live.
  const merging = mode === "merge" && canDecide && primary !== null && liveMembers.some((m) => sameRef(m.ref, primary));

  function enterMerge() {
    const initial = defaultPrimary(liveMembers);
    if (!initial) return;
    setPrimary(initial);
    setChoices(defaultFieldChoices(liveMembers, initial));
    setMode("merge");
  }

  function choosePrimary(ref: MemberRef) {
    setPrimary(ref);
    setChoices(defaultFieldChoices(liveMembers, ref));
  }

  function chooseField(key: FieldKey, ref: MemberRef) {
    setChoices((prev) => ({ ...prev, [key]: ref }));
  }

  function confirmMerge() {
    if (!primary) return;
    run(() => resolveGroupMerge(detail.batch.id, group.id, primary, choices));
    setMode("view");
  }

  const memberByKey = new Map(members.map((m) => [m.key, m]));
  const resultValue = (key: FieldKey): string | undefined => {
    const ref = choices[key];
    return ref ? memberByKey.get(refKey(ref))?.data[key] : undefined;
  };
  const columnCount = 1 + members.length + (merging ? 1 : 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <PanelHeader group={group} recordCount={members.length} merging={merging} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] align-top">
              <th scope="col" className="min-w-[150px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Field
              </th>
              {members.map((m) => (
                <MemberHeader
                  key={m.key}
                  member={m}
                  groupId={group.id}
                  merging={merging}
                  isPrimary={primary !== null && sameRef(m.ref, primary)}
                  onChoosePrimary={() => choosePrimary(m.ref)}
                  showSkip={!readOnly && !merging && group.status === "PENDING" && m.live && !!m.row}
                  onSkip={() => m.row && onSkipRow(m.row.id)}
                  busy={busy}
                />
              ))}
              {merging && (
                <th scope="col" className="min-w-[200px] px-4 py-3 text-left font-normal border-l border-[var(--color-border)] bg-[var(--color-accent)]/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">Result</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">What will be kept</p>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {FIELD_GROUPS.map((groupName) => (
              <Fragment key={groupName}>
                <tr>
                  <td colSpan={columnCount} className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
                    {groupName}
                  </td>
                </tr>
                {EMPLOYEE_FIELDS.filter((f) => f.group === groupName).map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    members={members}
                    tone={fieldTone(field, liveMembers)}
                    merging={merging}
                    groupId={group.id}
                    busy={busy}
                    choice={choices[field.key]}
                    onChoose={(ref) => chooseField(field.key, ref)}
                    resultValue={resultValue(field.key)}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <PanelFooter
        detail={detail}
        group={group}
        members={members}
        liveMembers={liveMembers}
        liveEmployeeCount={liveEmployeeCount}
        readOnly={readOnly}
        busy={busy}
        canDecide={canDecide}
        merging={merging}
        run={run}
        onMerge={enterMerge}
        onCancel={() => setMode("view")}
        onConfirm={confirmMerge}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function PanelHeader({ group, recordCount, merging }: { group: ImportGroupView; recordCount: number; merging: boolean }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border)]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {merging ? "Merge into one" : "Possible duplicate"}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{recordCount} records</span>
        <span className="flex flex-wrap items-center gap-1 ml-auto">
          {group.reasons.map((r) => (
            <span key={r} className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[10px] text-[var(--color-text-muted)]">
              {REASON_LABEL[r] ?? r}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {merging
          ? "Choose the primary record, then pick a winner for each field that differs. Blanks are filled from the other records."
          : "Fields that differ are highlighted; identical fields are dimmed."}
      </p>
    </div>
  );
}

function MemberHeader({
  member,
  groupId,
  merging,
  isPrimary,
  onChoosePrimary,
  showSkip,
  onSkip,
  busy,
}: {
  member: PanelMember;
  groupId: string;
  merging: boolean;
  isPrimary: boolean;
  onChoosePrimary: () => void;
  showSkip: boolean;
  onSkip: () => void;
  busy: boolean;
}) {
  return (
    <th scope="col" className={cn("min-w-[220px] px-4 py-3 text-left font-normal", !member.live && "opacity-60")}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{member.label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)] break-words">{member.name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {member.badges.map((b) => (
          <Chip key={b.label} badge={b} />
        ))}
        {member.href && (
          <Link
            href={member.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-accent)] hover:underline"
          >
            Open profile <Icon name="open_in_new" size={12} />
          </Link>
        )}
      </div>
      {merging && member.live && (
        <label className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-primary)] cursor-pointer">
          <input
            type="radio"
            name={`primary-${groupId}`}
            checked={isPrimary}
            disabled={busy}
            onChange={onChoosePrimary}
            className="accent-[var(--color-accent)]"
          />
          Primary
        </label>
      )}
      {showSkip && (
        <button type="button" onClick={onSkip} disabled={busy} className={cn(BUTTON.subtle, "mt-2 hover:text-red-500")}>
          <Icon name="block" size={12} /> Skip this row
        </button>
      )}
    </th>
  );
}

function FieldRow({
  field,
  members,
  tone,
  merging,
  groupId,
  busy,
  choice,
  onChoose,
  resultValue,
}: {
  field: FieldDef;
  members: PanelMember[];
  tone: Tone;
  merging: boolean;
  groupId: string;
  busy: boolean;
  choice: MemberRef | undefined;
  onChoose: (ref: MemberRef) => void;
  resultValue: string | undefined;
}) {
  const conflict = tone === "conflict";
  const valueClass = conflict
    ? "font-medium text-[var(--color-text-primary)]"
    : tone === "partial"
      ? "text-[var(--color-text-primary)]"
      : "text-[var(--color-text-muted)]";

  return (
    <tr className={cn("border-b border-[var(--color-border)]", conflict && "bg-amber-500/5")}>
      <td className={cn("px-4 py-2 align-top text-xs", conflict ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]")}>
        {field.label}
      </td>
      {members.map((m) => {
        const value = m.data[field.key]?.trim() ?? "";
        const selectable = merging && conflict && m.live;
        return (
          <td key={m.key} className={cn("px-4 py-2 align-top max-w-[320px] break-words", !m.live && "opacity-60")}>
            {selectable ? (
              <label className={cn("flex items-start gap-2", value ? "cursor-pointer" : "cursor-not-allowed")}>
                <input
                  type="radio"
                  name={`${groupId}-${field.key}`}
                  checked={!!choice && sameRef(choice, m.ref)}
                  disabled={!value || busy}
                  onChange={() => onChoose(m.ref)}
                  className="mt-1 shrink-0 accent-[var(--color-accent)]"
                />
                <Value value={value} className={valueClass} />
              </label>
            ) : (
              <Value value={value} className={valueClass} />
            )}
          </td>
        );
      })}
      {merging && (
        <td className="px-4 py-2 align-top max-w-[320px] break-words border-l border-[var(--color-border)] bg-[var(--color-accent)]/5">
          <Value value={resultValue ?? ""} className="text-[var(--color-text-primary)]" />
        </td>
      )}
    </tr>
  );
}

function Value({ value, className }: { value: string; className: string }) {
  return <span className={value ? className : "text-[var(--color-text-muted)]"}>{value || "—"}</span>;
}

function Note({ icon, tone, children }: { icon: string; tone?: "warn"; children: React.ReactNode }) {
  return (
    <p className={cn("inline-flex items-start gap-1.5 text-xs", tone === "warn" ? "text-amber-600" : "text-[var(--color-text-muted)]")}>
      <Icon name={icon} size={14} className="shrink-0 mt-px" />
      <span>{children}</span>
    </p>
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
  members: PanelMember[];
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
    <div className="px-4 py-3 space-y-2 border-t border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
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
    </div>
  );
}
