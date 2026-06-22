"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, timeAgo } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  getRecruiterCandidates,
  reassignAllCandidates,
  reassignSelectedCandidates,
} from "@/lib/actions/recruiter-manager";
import type {
  RecruiterManagerData,
  RecruiterSummary,
  CandidateRow,
} from "@/lib/actions/recruiter-manager-types";

export function RecruiterManagerView({ data }: { data: RecruiterManagerData }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [candidatesByRecruiter, setCandidatesByRecruiter] = useState<Record<string, CandidateRow[]>>({});
  const [loadingFor, setLoadingFor] = useState<string | null>(null);
  const [bulkPicker, setBulkPicker] = useState<string | null>(null); // recruiterId we're moving FROM
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [perRowPicker, setPerRowPicker] = useState<string | null>(null);
  const router = useRouter();

  const allRecruiterOptions = data.recruiters.map((r) => ({ id: r.id, name: r.name }));

  async function openRecruiter(rid: string | null) {
    const key = rid ?? "__unassigned__";
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (!candidatesByRecruiter[key]) {
      setLoadingFor(key);
      const rows = await getRecruiterCandidates(rid);
      setCandidatesByRecruiter((prev) => ({ ...prev, [key]: rows }));
      setLoadingFor(null);
    }
  }

  function toggleSelected(key: string, id: string) {
    setSelected((prev) => {
      const set = new Set(prev[key] ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, [key]: set };
    });
  }

  function selectAllFor(key: string) {
    const rows = candidatesByRecruiter[key] ?? [];
    setSelected((prev) => ({ ...prev, [key]: new Set(rows.map((r) => r.id)) }));
  }
  function clearSelectionFor(key: string) {
    setSelected((prev) => ({ ...prev, [key]: new Set() }));
  }

  function handleBulkAll(fromRid: string | null, toRid: string | null) {
    const fromLabel = fromRid ? data.recruiters.find((r) => r.id === fromRid)?.name ?? "this recruiter" : "Unassigned";
    const toLabel = toRid ? data.recruiters.find((r) => r.id === toRid)?.name ?? "selected recruiter" : "Unassigned";
    if (!confirm(`Move ALL candidates from ${fromLabel} to ${toLabel}?`)) return;
    startTransition(async () => {
      const res = await reassignAllCandidates(fromRid, toRid);
      alert(`Moved ${res.moved} candidates to ${toLabel}.`);
      setBulkPicker(null);
      setCandidatesByRecruiter({});
      setSelected({});
      router.refresh();
    });
  }

  function handleMoveSelected(fromKey: string, toRid: string | null) {
    const ids = Array.from(selected[fromKey] ?? []);
    if (ids.length === 0) {
      alert("Pick at least one candidate first.");
      return;
    }
    const toLabel = toRid ? data.recruiters.find((r) => r.id === toRid)?.name ?? "selected recruiter" : "Unassigned";
    if (!confirm(`Move ${ids.length} selected candidates to ${toLabel}?`)) return;
    startTransition(async () => {
      const res = await reassignSelectedCandidates(ids, toRid);
      alert(`Moved ${res.moved} candidates to ${toLabel}.`);
      setPerRowPicker(null);
      setCandidatesByRecruiter({});
      setSelected({});
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Top summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat label="Total candidates" value={data.totalCandidates} icon="group" />
        <SummaryStat label="Recruiters configured" value={data.recruiters.length} icon="badge" />
        <SummaryStat label="Unassigned" value={data.unassignedCount} icon="help" />
        <SummaryStat
          label="Active in pipeline (all)"
          value={data.recruiters.reduce((s, r) => s + r.totals.activePipeline, 0)}
          icon="target"
        />
      </div>

      {/* Recruiter cards */}
      <div className="space-y-3">
        {data.recruiters.map((r) => {
          const key = r.id;
          const isOpen = expanded === key;
          const rows = candidatesByRecruiter[key] ?? [];
          const selSet = selected[key] ?? new Set();
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]"
            >
              <RecruiterCardHeader
                r={r}
                isOpen={isOpen}
                onToggle={() => openRecruiter(r.id)}
                onBulkMoveClick={() => setBulkPicker(bulkPicker === r.id ? null : r.id)}
              />

              {bulkPicker === r.id && (
                <div className="border-t border-[var(--color-border)] px-4 py-3 flex items-center gap-2 flex-wrap bg-[var(--color-surface-container)]/40">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Move ALL {r.totals.assigned} candidates from <strong>{r.name}</strong> to:
                  </span>
                  {allRecruiterOptions
                    .filter((o) => o.id !== r.id)
                    .map((o) => (
                      <button
                        key={o.id}
                        disabled={isPending}
                        onClick={() => handleBulkAll(r.id, o.id)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {o.name}
                      </button>
                    ))}
                  <button
                    disabled={isPending}
                    onClick={() => handleBulkAll(r.id, null)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                    title="Detach all candidates so anyone can pick them up"
                  >
                    Unassign all
                  </button>
                  <button
                    onClick={() => setBulkPicker(null)}
                    className="px-2 py-1 rounded-md text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {isOpen && (
                <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
                  {loadingFor === key ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Loading candidates…</p>
                  ) : rows.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">No candidates assigned.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => selectAllFor(key)}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-xs text-[var(--color-text-muted)]">·</span>
                        <button
                          onClick={() => clearSelectionFor(key)}
                          className="text-xs text-[var(--color-text-muted)] hover:underline"
                        >
                          Clear
                        </button>
                        <span className="text-xs text-[var(--color-text-muted)]">·</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {selSet.size} of {rows.length} selected
                        </span>
                        {selSet.size > 0 && (
                          <span className="ml-auto flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-[var(--color-text-muted)]">Move selected to:</span>
                            {allRecruiterOptions
                              .filter((o) => o.id !== r.id)
                              .map((o) => (
                                <button
                                  key={o.id}
                                  disabled={isPending}
                                  onClick={() => handleMoveSelected(key, o.id)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  {o.name}
                                </button>
                              ))}
                            <button
                              disabled={isPending}
                              onClick={() => handleMoveSelected(key, null)}
                              className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                            >
                              Unassign
                            </button>
                          </span>
                        )}
                      </div>

                      <CandidateTable
                        rows={rows}
                        selected={selSet}
                        onToggle={(id) => toggleSelected(key, id)}
                        onMoveOne={(id) => setPerRowPicker(perRowPicker === id ? null : id)}
                        perRowPicker={perRowPicker}
                        currentRecruiterId={r.id}
                        allRecruiterOptions={allRecruiterOptions}
                        onPickPerRow={(id, toRid) => {
                          setPerRowPicker(null);
                          startTransition(async () => {
                            const res = await reassignSelectedCandidates([id], toRid);
                            if (res.moved === 0) alert("Move did not apply.");
                            setCandidatesByRecruiter({});
                            router.refresh();
                          });
                        }}
                        isPending={isPending}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unassigned bucket */}
        {data.unassignedCount > 0 && (
          <UnassignedSection
            count={data.unassignedCount}
            isOpen={expanded === "__unassigned__"}
            loading={loadingFor === "__unassigned__"}
            onToggle={() => openRecruiter(null)}
            rows={candidatesByRecruiter["__unassigned__"] ?? []}
            selected={selected["__unassigned__"] ?? new Set()}
            onToggleRow={(id) => toggleSelected("__unassigned__", id)}
            onSelectAll={() => selectAllFor("__unassigned__")}
            onClearSelection={() => clearSelectionFor("__unassigned__")}
            allRecruiterOptions={allRecruiterOptions}
            onClaimAll={(toRid) => handleBulkAll(null, toRid)}
            onMoveSelected={(toRid) => handleMoveSelected("__unassigned__", toRid)}
            isPending={isPending}
          />
        )}
      </div>
    </div>
  );
}

function RecruiterCardHeader({
  r,
  isOpen,
  onToggle,
  onBulkMoveClick,
}: {
  r: RecruiterSummary;
  isOpen: boolean;
  onToggle: () => void;
  onBulkMoveClick: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-3 text-left"
      >
        <Icon name={isOpen ? "expand_more" : "chevron_right"} size={20} className="text-[var(--color-text-muted)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--color-text-primary)]">{r.name}</span>
            {r.jobTitle && <span className="text-xs text-[var(--color-text-muted)]">{r.jobTitle}</span>}
            {r.status === "OFFBOARDED" && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-500">
                offboarded · reassign candidates
              </span>
            )}
            {!r.hasLoginAccount && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-500">
                no login
              </span>
            )}
          </div>
          {r.loginEmail && (
            <p className="text-xs text-[var(--color-text-muted)] truncate">{r.loginEmail}</p>
          )}
        </div>
      </button>

      <div className="hidden md:flex items-center gap-4 text-center text-xs">
        <Stat label="Active" value={r.totals.activePipeline} accent="emerald" />
        <Stat label="Total" value={r.totals.assigned} />
        <Stat label="Hired (30d)" value={r.totals.hiredThisMonth} accent="purple" />
        <Stat label="New (7d)" value={r.totals.appsThisWeek} accent="blue" />
        <Stat label="Interviews (7d)" value={r.totals.interviewsThisWeek} accent="amber" />
        <Stat label="Last activity" value={r.lastActivityAt ? timeAgo(r.lastActivityAt) : "never"} small />
      </div>

      <button
        onClick={onBulkMoveClick}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] inline-flex items-center gap-1"
        title="Move all this recruiter's candidates to someone else"
      >
        <Icon name="swap_horiz" size={14} />
        Move all
      </button>
    </div>
  );
}

function CandidateTable({
  rows,
  selected,
  onToggle,
  onMoveOne,
  perRowPicker,
  currentRecruiterId,
  allRecruiterOptions,
  onPickPerRow,
  isPending,
}: {
  rows: CandidateRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onMoveOne: (id: string) => void;
  perRowPicker: string | null;
  currentRecruiterId: string | null;
  allRecruiterOptions: { id: string; name: string }[];
  onPickPerRow: (id: string, toRid: string | null) => void;
  isPending: boolean;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="grid grid-cols-[36px_1fr_1fr_140px_120px_80px] text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-container)] px-3 py-2 border-b border-[var(--color-border)]">
        <span />
        <span>Candidate</span>
        <span>Position</span>
        <span>Status</span>
        <span>Applied</span>
        <span className="text-right">Move</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rows.map((c) => {
          const checked = selected.has(c.id);
          const isPicker = perRowPicker === c.id;
          return (
            <div key={c.id} className="px-3 py-2">
              <div className="grid grid-cols-[36px_1fr_1fr_140px_120px_80px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(c.id)}
                  className="h-4 w-4"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.firstName} {c.lastName}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{c.email}</p>
                </div>
                <p className="text-[12px] text-[var(--color-text-muted)] truncate">{c.positionTitle || "—"}</p>
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-fit px-2 py-0.5 rounded-full text-[10px] font-medium",
                    c.inPipeline ? "bg-emerald-500/10 text-emerald-500" : "bg-[var(--color-surface-container-high)] text-[var(--color-text-muted)]"
                  )}
                >
                  {c.status.replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">{timeAgo(new Date(c.createdAt))}</span>
                <div className="flex justify-end">
                  <button
                    onClick={() => onMoveOne(c.id)}
                    className="px-2 py-0.5 rounded-md text-[11px] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Move
                  </button>
                </div>
              </div>
              {isPicker && (
                <div className="mt-2 pl-9 flex items-center gap-2 flex-wrap">
                  {allRecruiterOptions
                    .filter((o) => o.id !== currentRecruiterId)
                    .map((o) => (
                      <button
                        key={o.id}
                        disabled={isPending}
                        onClick={() => onPickPerRow(c.id, o.id)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {o.name}
                      </button>
                    ))}
                  <button
                    disabled={isPending}
                    onClick={() => onPickPerRow(c.id, null)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                  >
                    Unassign
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnassignedSection({
  count,
  isOpen,
  loading,
  onToggle,
  rows,
  selected,
  onToggleRow,
  onSelectAll,
  onClearSelection,
  allRecruiterOptions,
  onClaimAll,
  onMoveSelected,
  isPending,
}: {
  count: number;
  isOpen: boolean;
  loading: boolean;
  onToggle: () => void;
  rows: CandidateRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  allRecruiterOptions: { id: string; name: string }[];
  onClaimAll: (toRid: string) => void;
  onMoveSelected: (toRid: string | null) => void;
  isPending: boolean;
}) {
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)]/50">
      <div className="flex items-center gap-4 px-4 py-3">
        <button onClick={onToggle} className="flex-1 flex items-center gap-3 text-left">
          <Icon name={isOpen ? "expand_more" : "chevron_right"} size={20} className="text-[var(--color-text-muted)]" />
          <div>
            <p className="font-semibold">Unassigned candidates</p>
            <p className="text-xs text-[var(--color-text-muted)]">{count} candidate{count === 1 ? "" : "s"} waiting for a recruiter</p>
          </div>
        </button>
        <button
          onClick={() => setClaimPickerOpen((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] inline-flex items-center gap-1"
        >
          <Icon name="assignment_ind" size={14} />
          Assign all
        </button>
      </div>
      {claimPickerOpen && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 flex items-center gap-2 flex-wrap bg-[var(--color-surface-container)]/40">
          <span className="text-xs text-[var(--color-text-muted)]">Assign all {count} to:</span>
          {allRecruiterOptions.map((o) => (
            <button
              key={o.id}
              disabled={isPending}
              onClick={() => {
                onClaimAll(o.id);
                setClaimPickerOpen(false);
              }}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {o.name}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No unassigned candidates.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onSelectAll} className="text-xs text-[var(--color-primary)] hover:underline">
                  Select all
                </button>
                <span className="text-xs text-[var(--color-text-muted)]">·</span>
                <button onClick={onClearSelection} className="text-xs text-[var(--color-text-muted)] hover:underline">
                  Clear
                </button>
                <span className="text-xs text-[var(--color-text-muted)]">·</span>
                <span className="text-xs text-[var(--color-text-muted)]">{selected.size} of {rows.length} selected</span>
                {selected.size > 0 && (
                  <span className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[var(--color-text-muted)]">Assign selected to:</span>
                    {allRecruiterOptions.map((o) => (
                      <button
                        key={o.id}
                        disabled={isPending}
                        onClick={() => onMoveSelected(o.id)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {o.name}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <CandidateTable
                rows={rows}
                selected={selected}
                onToggle={onToggleRow}
                onMoveOne={() => {}}
                perRowPicker={null}
                currentRecruiterId={null}
                allRecruiterOptions={allRecruiterOptions}
                onPickPerRow={() => {}}
                isPending={isPending}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string | number; accent?: "emerald" | "purple" | "blue" | "amber"; small?: boolean }) {
  const colorMap = {
    emerald: "text-emerald-500",
    purple: "text-purple-500",
    blue: "text-blue-500",
    amber: "text-amber-500",
  } as const;
  const valueColor = accent ? colorMap[accent] : "text-[var(--color-text-primary)]";
  return (
    <div className="min-w-[64px]">
      <p className={cn("font-semibold leading-none", small ? "text-[11px]" : "text-sm", valueColor)}>{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{label}</p>
    </div>
  );
}

function SummaryStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
        <Icon name={icon} size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
      </div>
    </div>
  );
}
