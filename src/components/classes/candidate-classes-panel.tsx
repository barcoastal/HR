"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { addCandidatesToClass, getCandidateClasses, updateClassMember } from "@/lib/actions/recruitment-classes";
import type { ClassColor } from "@/lib/recruitment-classes/logic";
import type { CandidateClassesPayload } from "@/lib/recruitment-classes/types";
import { ColorChip, ColorPicker, formatStartDate } from "./class-ui";

/**
 * "Classes" block for the candidate detail dialog: which start-date classes
 * this candidate is in (with their color) and an Add-to-class action.
 * Self-contained so the dialog only needs to render it.
 */
export function CandidateClassesPanel({ candidateId }: { candidateId: string }) {
  const [data, setData] = useState<CandidateClassesPayload | null>(null);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getCandidateClasses(candidateId)
      .then(setData)
      .catch(() => setData(null));
  }, [candidateId]);

  useEffect(() => {
    setData(null);
    setPicking(false);
    setError(null);
    load();
  }, [load]);

  if (!data) return null;
  if (data.memberships.length === 0 && !data.canAdd) return null;

  async function add() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    const res = await addCandidatesToClass(choice, [candidateId]);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setPicking(false);
    setChoice("");
    load();
  }

  async function changeColor(memberId: string, color: ClassColor) {
    setError(null);
    const res = await updateClassMember(memberId, { color });
    if (!res.success) setError(res.error);
    load();
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-background)]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon name="event_upcoming" size={14} className="text-[var(--color-accent)]" />
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Classes ({data.memberships.length})</p>
        </div>
        {data.canAdd && !picking && data.options.length > 0 && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
          >
            <Icon name="add" size={14} />
            Add to class
          </button>
        )}
      </div>

      {data.memberships.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Not in any class yet.{data.canAdd && data.options.length === 0 ? " There are no upcoming classes to add them to." : ""}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.memberships.map((m) => (
            <li key={m.memberId} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/classes/${m.classId}`} className="min-w-0 text-xs text-[var(--color-text-primary)] hover:underline">
                <span className="font-medium">{m.className}</span>
                <span className="text-[var(--color-text-muted)]"> · starts {formatStartDate(m.startDate, { month: "short", day: "numeric" })}</span>
              </Link>
              {data.canEdit ? (
                <ColorPicker value={m.color} onChange={(c) => changeColor(m.memberId, c)} />
              ) : (
                <ColorChip color={m.color} />
              )}
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={cn(
              "flex-1 min-w-[180px] px-2 py-1.5 rounded-lg text-xs",
              "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]",
            )}
          >
            <option value="">Choose a class…</option>
            {data.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({formatStartDate(o.startDate, { month: "short", day: "numeric" })})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={!choice || busy}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {busy ? "Adding..." : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
