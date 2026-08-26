"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { EMPLOYEE_FIELDS, FIELD_GROUPS } from "@/lib/import-export/employee-fields";
import { defaultFieldChoices } from "@/lib/import-export/merge";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/import-export/normalize";
import {
  refKey,
  sameRef,
  type EmployeeSnapshot,
  type FieldDef,
  type FieldKey,
  type GroupReason,
  type MemberRef,
  type MergeMember,
} from "@/lib/import-export/types";
import { Chip, type Badge } from "./row-editor";

/**
 * Side-by-side comparison of the records in a duplicate group — one column per record, one row
 * per field — with an optional merge mode (primary radio, per-field winners, editable Result
 * column). Presentational: the wrapper owns the members, the merge state (see `useMergeState`)
 * and the footer actions.
 */

/** One column of the compare table. */
export type PanelMember = MergeMember & {
  key: string;
  label: string;
  name: string;
  badges: Badge[];
  href?: string;
  /** Still part of the decision (a live import row, or an employee that still exists). */
  live: boolean;
};

export type FieldChoices = Partial<Record<FieldKey, MemberRef>>;
export type Overrides = Partial<Record<FieldKey, string>>;

/** How the live members' values for one field relate to each other. */
type Tone = "conflict" | "same" | "partial" | "empty";

export const REASON_LABEL: Record<string, string> = { email: "Same email", phone: "Same phone", name: "Same name" };
export const ARCHIVED_BADGE: Badge = { label: "Archived", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" };
export const MISSING_BADGE: Badge = { label: "No longer exists", className: "bg-red-500/10 text-red-500" };

export function statusBadge(status: string): Badge {
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, "-");
  return { label, className: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" };
}

/** Column for an existing employee ("Already in system"), or a placeholder when it is gone. */
export function employeeMember(ref: MemberRef, employee: EmployeeSnapshot | undefined, extraBadges: Badge[] = []): PanelMember {
  return {
    ref,
    key: refKey(ref),
    data: employee?.data ?? {},
    label: "Already in system",
    name: employee?.name ?? "Unknown person",
    badges: employee ? [statusBadge(employee.status), ...(employee.archived ? [ARCHIVED_BADGE] : []), ...extraBadges] : [MISSING_BADGE],
    href: employee ? `/people/${ref.id}` : undefined,
    live: !!employee,
  };
}

/** The existing employee if there is one, otherwise the first live member. */
export function defaultPrimary(live: PanelMember[]): MemberRef | null {
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

// ---------------------------------------------------------------------------
// Merge-mode state
// ---------------------------------------------------------------------------

export type MergeState = {
  /** True while merge mode is on and still valid (a decision is possible, the primary is live). */
  merging: boolean;
  primary: MemberRef | null;
  choices: FieldChoices;
  overrides: Overrides;
  enter: () => void;
  cancel: () => void;
  choosePrimary: (ref: MemberRef) => void;
  chooseField: (key: FieldKey, ref: MemberRef) => void;
  edit: (key: FieldKey, value: string) => void;
  reset: (key: FieldKey) => void;
};

export function useMergeState(liveMembers: PanelMember[], canDecide: boolean): MergeState {
  const [mode, setMode] = useState<"view" | "merge">("view");
  const [primary, setPrimary] = useState<MemberRef | null>(null);
  const [choices, setChoices] = useState<FieldChoices>({});
  const [overrides, setOverrides] = useState<Overrides>({});

  // Merge mode only makes sense while a decision is still possible and the chosen primary is still live.
  const merging = mode === "merge" && canDecide && primary !== null && liveMembers.some((m) => sameRef(m.ref, primary));

  function reset(key: FieldKey) {
    setOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return {
    merging,
    primary,
    choices,
    overrides,
    enter() {
      const initial = defaultPrimary(liveMembers);
      if (!initial) return;
      setPrimary(initial);
      setChoices(defaultFieldChoices(liveMembers, initial));
      setOverrides({});
      setMode("merge");
    },
    cancel() {
      setMode("view");
    },
    choosePrimary(ref) {
      setPrimary(ref);
      setChoices(defaultFieldChoices(liveMembers, ref));
      setOverrides({});
    },
    chooseField(key, ref) {
      setChoices((prev) => ({ ...prev, [key]: ref }));
      reset(key);
    },
    edit(key, value) {
      setOverrides((prev) => ({ ...prev, [key]: value }));
    },
    reset,
  };
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type Props = {
  members: PanelMember[];
  groupId: string;
  reasons: GroupReason[];
  busy: boolean;
  merging: boolean;
  primary: MemberRef | null;
  choices: FieldChoices;
  overrides: Overrides;
  onChoosePrimary: (ref: MemberRef) => void;
  onChooseField: (key: FieldKey, ref: MemberRef) => void;
  onEdit: (key: FieldKey, value: string) => void;
  onReset: (key: FieldKey) => void;
  /** Extra controls under a column header (e.g. "Skip this row"). */
  memberExtra?: (member: PanelMember) => React.ReactNode;
  /** Rendered inside the card below the table. */
  footer?: React.ReactNode;
};

export function CompareTable({
  members,
  groupId,
  reasons,
  busy,
  merging,
  primary,
  choices,
  overrides,
  onChoosePrimary,
  onChooseField,
  onEdit,
  onReset,
  memberExtra,
  footer,
}: Props) {
  const liveMembers = members.filter((m) => m.live);
  const memberByKey = new Map(members.map((m) => [m.key, m]));
  const resultValue = (key: FieldKey): string | undefined => {
    const ref = choices[key];
    return ref ? memberByKey.get(refKey(ref))?.data[key] : undefined;
  };
  const columnCount = 1 + members.length + (merging ? 1 : 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <TableHeader reasons={reasons} recordCount={members.length} merging={merging} />

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
                  groupId={groupId}
                  merging={merging}
                  isPrimary={primary !== null && sameRef(m.ref, primary)}
                  onChoosePrimary={() => onChoosePrimary(m.ref)}
                  busy={busy}
                  extra={memberExtra?.(m)}
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
                    groupId={groupId}
                    busy={busy}
                    choice={choices[field.key]}
                    onChoose={(ref) => onChooseField(field.key, ref)}
                    resultValue={resultValue(field.key)}
                    override={overrides[field.key]}
                    onEdit={(v) => onEdit(field.key, v)}
                    onReset={() => onReset(field.key)}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function TableHeader({ reasons, recordCount, merging }: { reasons: GroupReason[]; recordCount: number; merging: boolean }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border)]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {merging ? "Merge into one" : "Possible duplicate"}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{recordCount} records</span>
        <span className="flex flex-wrap items-center gap-1 ml-auto">
          {reasons.map((r) => (
            <span key={r} className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[10px] text-[var(--color-text-muted)]">
              {REASON_LABEL[r] ?? r}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {merging
          ? "Choose the primary record, pick a winner for each field that differs, and type over anything in the Result column. That column is exactly what gets saved."
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
  busy,
  extra,
}: {
  member: PanelMember;
  groupId: string;
  merging: boolean;
  isPrimary: boolean;
  onChoosePrimary: () => void;
  busy: boolean;
  extra?: React.ReactNode;
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
      {extra}
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
  override,
  onEdit,
  onReset,
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
  override: string | undefined;
  onEdit: (value: string) => void;
  onReset: () => void;
}) {
  const edited = override !== undefined;
  const editValue = override ?? resultValue ?? "";
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
        <td className="px-3 py-1.5 align-top max-w-[320px] border-l border-[var(--color-border)] bg-[var(--color-accent)]/5">
          <div className="flex items-center gap-1">
            {field.type === "enum" ? (
              <select
                value={editValue}
                disabled={busy}
                onChange={(e) => onEdit(e.target.value)}
                aria-label={`Result for ${field.label}`}
                className={cn(RESULT_INPUT, edited && "border-[var(--color-accent)]")}
              >
                <option value="">—</option>
                {(field.enumValues ?? []).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "date" ? "date" : "text"}
                value={editValue}
                disabled={busy}
                onChange={(e) => onEdit(e.target.value)}
                placeholder="—"
                aria-label={`Result for ${field.label}`}
                className={cn(RESULT_INPUT, edited && "border-[var(--color-accent)]")}
              />
            )}
            {edited && (
              <button
                type="button"
                onClick={onReset}
                disabled={busy}
                title="Revert to the selected value"
                className="shrink-0 rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              >
                <Icon name="undo" size={14} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

const RESULT_INPUT =
  "w-full min-w-[160px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 disabled:opacity-50";

function Value({ value, className }: { value: string; className: string }) {
  return <span className={value ? className : "text-[var(--color-text-muted)]"}>{value || "—"}</span>;
}

export function Note({ icon, tone, children }: { icon: string; tone?: "warn"; children: React.ReactNode }) {
  return (
    <p className={cn("inline-flex items-start gap-1.5 text-xs", tone === "warn" ? "text-amber-600" : "text-[var(--color-text-muted)]")}>
      <Icon name={icon} size={14} className="shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  );
}

/** Card footer shared by the compare wrappers. */
export function TableFooter({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 space-y-2 border-t border-[var(--color-border)] bg-[var(--color-surface-container-low)]">{children}</div>;
}
