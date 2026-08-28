"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { approveAndInviteEmployee, bulkApproveAndInviteEmployees, deletePendingEmployees } from "@/lib/actions/employees";
import { EMPLOYEE_FIELDS } from "@/lib/import-export/employee-fields";
import type { RowData } from "@/lib/import-export/types";

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
  danger: "inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50",
  subtle: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50",
};

/** Review table for people who exist in the system but have no login yet. */
export function PendingPeople({ people }: { people: PendingPerson[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"approve" | "delete" | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(true);

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

  const allSelected = people.length > 0 && selected.size === people.length;
  const targets = selected.size > 0 ? Array.from(selected) : people.map((p) => p.id);
  const targetLabel = selected.size > 0 ? `${selected.size} selected` : `all ${people.length}`;

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
              return (
                <tr key={p.id} className={cn("border-t border-[var(--color-border)]", checked && "bg-[var(--color-accent)]/5")}>
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
    </div>
  );
}
