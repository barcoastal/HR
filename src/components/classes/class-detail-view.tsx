"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  addCandidatesToClass,
  deleteRecruitmentClass,
  removeClassMember,
  searchCandidatesForClass,
  updateClassMember,
} from "@/lib/actions/recruitment-classes";
import {
  CLASS_COLORS,
  CLASS_COLOR_META,
  CLASS_STATUS_LABEL,
  countByColor,
  daysUntil,
  describeDaysUntil,
  remainingToTarget,
  rosterToCsv,
  type ClassColor,
} from "@/lib/recruitment-classes/logic";
import type { CandidatePickerOption, ClassDetail, ClassMemberRow, ClassPermissions } from "@/lib/recruitment-classes/types";
import { ClassFormDialog } from "./class-form-dialog";
import { ColorDot, ColorLegend, ColorPicker, CountsBar, formatStartDate, ghostButtonClass, inputClass, primaryButtonClass } from "./class-ui";

type PositionOption = { id: string; title: string; status: string };

function NoteField({ member, onSaved }: { member: ClassMemberRow; onSaved: (note: string | null) => void }) {
  const [value, setValue] = useState(member.note ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(member.note ?? ""), [member.note]);

  async function commit() {
    const next = value.trim();
    if (next === (member.note ?? "")) return;
    setSaving(true);
    const res = await updateClassMember(member.id, { note: next });
    setSaving(false);
    if (res.success) onSaved(next || null);
    else setValue(member.note ?? "");
  }

  if (!member.canEdit) {
    return <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">{member.note || "—"}</p>;
  }
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder={saving ? "Saving..." : "Add a note"}
      aria-label={`Note for ${member.name}`}
      className={cn(inputClass, "py-1.5 text-xs")}
    />
  );
}

function AddCandidatesPanel({ classId, onDone }: { classId: string; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidatePickerOption[]>([]);
  const [selected, setSelected] = useState<Map<string, CandidatePickerOption>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchCandidatesForClass(classId, q);
        if (mine === seq.current) setResults(rows);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, classId]);

  function toggle(c: CandidatePickerOption) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  }

  async function add() {
    setSaving(true);
    setError(null);
    const res = await addCandidatesToClass(classId, [...selected.keys()]);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSelected(new Map());
    setQuery("");
    onDone();
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="search" size={18} className="text-[var(--color-text-muted)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates by name, email or phone"
          className={inputClass}
        />
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...selected.values()].map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c)}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-accent)]"
            >
              {c.name}
              <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto divide-y divide-[var(--color-border)]">
        {loading && results.length === 0 && <p className="py-3 text-xs text-[var(--color-text-muted)]">Searching...</p>}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p className="py-3 text-xs text-[var(--color-text-muted)]">No matching candidates who aren&apos;t already in this class.</p>
        )}
        {results.map((c) => {
          const checked = selected.has(c.id);
          return (
            <label key={c.id} className="flex items-center gap-3 py-2 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={() => toggle(c)} className="h-4 w-4 accent-[var(--color-accent)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{c.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {c.stage}
                  {c.positionTitle ? ` · ${c.positionTitle}` : ""} · {c.email}
                </p>
              </div>
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className={ghostButtonClass}>
          Close
        </button>
        <button onClick={add} disabled={selected.size === 0 || saving} className={primaryButtonClass}>
          {saving ? "Adding..." : selected.size ? `Add ${selected.size} to class` : "Add to class"}
        </button>
      </div>
    </div>
  );
}

export function ClassDetailView({
  cls,
  permissions,
  positions,
  todayKey,
}: {
  cls: ClassDetail;
  permissions: ClassPermissions;
  positions: PositionOption[];
  todayKey: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<ClassMemberRow[]>(cls.members);
  const [filter, setFilter] = useState<ClassColor | "ALL">("ALL");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMembers(cls.members), [cls.members]);

  // Scoped recruiters see only their rows, so keep the server's whole-class
  // counts for them; everyone else gets live counts as colors change.
  const counts = cls.scoped ? cls.counts : countByColor(members);
  const visibleCounts = countByColor(members);
  const shown = useMemo(() => (filter === "ALL" ? members : members.filter((m) => m.color === filter)), [members, filter]);
  const days = daysUntil(cls.startDate, todayKey);
  const remaining = remainingToTarget(counts, cls.targetCount);

  async function changeColor(m: ClassMemberRow, color: ClassColor) {
    setError(null);
    const prev = m.color;
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, color } : x)));
    setBusyId(m.id);
    const res = await updateClassMember(m.id, { color });
    setBusyId(null);
    if (!res.success) {
      setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, color: prev } : x)));
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  async function remove(m: ClassMemberRow) {
    if (!confirm(`Remove ${m.name} from ${cls.name}? Their candidate record is not changed.`)) return;
    setBusyId(m.id);
    const res = await removeClassMember(m.id);
    setBusyId(null);
    if (!res.success) setError(res.error);
    else {
      setMembers((list) => list.filter((x) => x.id !== m.id));
      router.refresh();
    }
  }

  async function deleteClass() {
    if (!confirm(`Delete ${cls.name}? This removes the class and its roster colors. Candidate records are not changed.`)) return;
    const res = await deleteRecruitmentClass(cls.id);
    if (!res.success) setError(res.error);
    else router.push("/classes");
  }

  function exportCsv() {
    const csv = rosterToCsv(
      shown.map((m) => ({ name: m.name, color: m.color, stage: m.stage, email: m.email, phone: m.phone, recruiter: m.recruiter, note: m.note })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "class"}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/classes" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <Icon name="arrow_back" size={14} />
          All classes
        </Link>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-primary)] md:text-2xl">{cls.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {cls.role}
              {cls.positionTitle && cls.positionTitle !== cls.role ? ` · ${cls.positionTitle}` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              Starts {formatStartDate(cls.startDate)}
              <span className="text-[var(--color-text-muted)]">
                {" · "}
                {cls.status === "UPCOMING" ? describeDaysUntil(days) : CLASS_STATUS_LABEL[cls.status]}
              </span>
            </p>
            {cls.notes && <p className="mt-2 text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">{cls.notes}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {members.length > 0 && (
              <button onClick={exportCsv} className={ghostButtonClass} title="Download the roster shown below as CSV">
                <Icon name="download" size={16} />
                Export CSV
              </button>
            )}
            {permissions.canManage && (
              <>
                <ClassFormDialog
                  positions={positions}
                  existing={cls}
                  trigger={(open) => (
                    <button onClick={open} className={ghostButtonClass}>
                      <Icon name="edit" size={16} />
                      Edit
                    </button>
                  )}
                />
                <button onClick={deleteClass} className={cn(ghostButtonClass, "hover:text-red-600")}>
                  <Icon name="delete" size={16} />
                  Delete
                </button>
              </>
            )}
            {permissions.canEditMembers && (
              <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
                <Icon name="person_add" size={16} />
                Add candidates
              </button>
            )}
          </div>
        </div>
        <CountsBar counts={counts} target={cls.targetCount} className="mt-4" />
        {remaining !== null && remaining > 0 && (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {remaining} more cleared candidate{remaining === 1 ? "" : "s"} needed to reach the target of {cls.targetCount}.
          </p>
        )}
      </div>

      {adding && (
        <AddCandidatesPanel
          classId={cls.id}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ColorLegend />
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by color">
          {(["ALL", ...CLASS_COLORS] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              {f !== "ALL" && <ColorDot color={f} />}
              {f === "ALL" ? `All (${visibleCounts.total})` : `${CLASS_COLOR_META[f].label} (${visibleCounts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {cls.scoped && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Showing your candidates only ({members.length} of {cls.totalMembers}). Counts above cover the whole class.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {members.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <Icon name="group_add" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No candidates in this class yet</p>
          {permissions.canEditMembers && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Use Add candidates to build the roster. New members start Yellow (in process).</p>
          )}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No candidates with this color.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-4 py-2 font-medium">Candidate</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Recruiter</th>
                <th className="px-4 py-2 font-medium">Color</th>
                <th className="px-4 py-2 font-medium min-w-[180px]">Note</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {shown.map((m) => (
                <tr key={m.id} className="align-middle">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ColorDot color={m.color} />
                      <Link
                        href={`/cv?candidateId=${m.candidateId}`}
                        className={cn("font-medium hover:underline", m.doNotCall ? "text-red-600" : "text-[var(--color-text-primary)]")}
                      >
                        {m.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--color-text-primary)] whitespace-nowrap">{m.stage}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="block text-[var(--color-text-primary)] hover:underline whitespace-nowrap">
                        {m.phone}
                      </a>
                    )}
                    <a href={`mailto:${m.email}`} className="block text-[var(--color-text-muted)] hover:underline truncate max-w-[220px]">
                      {m.email}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{m.recruiter || "—"}</td>
                  <td className="px-4 py-2.5">
                    {m.canEdit ? (
                      <ColorPicker value={m.color} onChange={(c) => changeColor(m, c)} disabled={busyId === m.id} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <ColorDot color={m.color} />
                        {CLASS_COLOR_META[m.color].meaning}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <NoteField
                      member={m}
                      onSaved={(note) => setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, note } : x)))}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {m.canEdit && (
                      <button
                        onClick={() => remove(m)}
                        disabled={busyId === m.id}
                        className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-red-600 disabled:opacity-50"
                        title="Remove from class"
                        aria-label={`Remove ${m.name} from class`}
                      >
                        <Icon name="person_remove" size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
