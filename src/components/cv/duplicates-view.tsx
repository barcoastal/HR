"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { mergeAllDuplicates, mergeCandidates } from "@/lib/actions/candidate-duplicates";
import type { DuplicateGroup } from "@/lib/actions/candidate-duplicates";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

const MATCH_TINT: Record<DuplicateGroup["matchType"], string> = {
  phone: "bg-blue-500/10 text-blue-500",
  email_normalized: "bg-purple-500/10 text-purple-500",
  name: "bg-amber-500/10 text-amber-500",
};
const MATCH_ICON: Record<DuplicateGroup["matchType"], string> = {
  phone: "call",
  email_normalized: "mail",
  name: "person",
};

export function DuplicatesView({ groups }: { groups: DuplicateGroup[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-[var(--color-text-muted)]">
          Found <strong className="text-[var(--color-text-primary)]">{groups.length}</strong> possible duplicate group{groups.length === 1 ? "" : "s"}. Pick the primary manually or merge them all at once.
        </p>
        <MergeAllButton groups={groups} />
      </div>
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function MergeAllButton({ groups }: { groups: DuplicateGroup[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ groupsMerged: number; candidatesMerged: number; errors: { groupId: string; error: string }[] } | null>(null);

  const totalCandidates = groups.reduce((sum, g) => sum + Math.max(0, g.candidates.length - 1), 0);

  function handleMergeAll() {
    if (groups.length === 0) return;
    if (!confirm(
      `Merge all ${groups.length} duplicate groups?\n\n` +
      `~${totalCandidates} candidate row${totalCandidates === 1 ? "" : "s"} will be folded into their primary records. ` +
      `For each group the primary is auto-picked (most applications → earliest record → local resume on file). ` +
      `Every duplicate's applications, interviews, and signed docs are preserved on the primary.\n\nCannot be undone.`
    )) return;
    setResult(null);
    startTransition(async () => {
      const r = await mergeAllDuplicates();
      setResult(r);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs text-[var(--color-text-muted)]">
          Merged {result.groupsMerged} group{result.groupsMerged === 1 ? "" : "s"} · {result.candidatesMerged} candidate{result.candidatesMerged === 1 ? "" : "s"} folded in
          {result.errors.length > 0 && <span className="text-red-500"> · {result.errors.length} failed</span>}
        </span>
      )}
      <button
        onClick={handleMergeAll}
        disabled={pending || groups.length === 0}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Icon name="merge" size={14} />
        {pending ? "Merging all…" : `Merge all ${groups.length} groups`}
      </button>
    </div>
  );
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  const router = useRouter();
  const [primaryId, setPrimaryId] = useState<string>(group.candidates[0].id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    if (id === primaryId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMerge() {
    if (selected.size === 0) return;
    if (!confirm(`Merge ${selected.size} candidate${selected.size === 1 ? "" : "s"} into the primary? This moves their applications, interviews, and signed docs onto the primary record and deletes the duplicates. Cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await mergeCandidates(primaryId, Array.from(selected));
      if (!res.success) {
        setError(res.error || "Merge failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", MATCH_TINT[group.matchType])}>
            <Icon name={MATCH_ICON[group.matchType]} size={11} />
            {group.matchLabel}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">{group.candidates.length} candidates</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">{selected.size} to merge into primary</span>
          <button
            onClick={handleMerge}
            disabled={selected.size === 0 || pending}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {pending ? "Merging…" : "Merge selected"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {group.candidates.map((c) => {
          const isPrimary = c.id === primaryId;
          const isSelected = selected.has(c.id);
          const initials = getInitials(c.firstName, c.lastName);
          const colorIdx = c.firstName.charCodeAt(0) % avatarColors.length;
          return (
            <div key={c.id} className={cn("p-3 flex items-center gap-3", isPrimary && "bg-[var(--color-accent)]/5")}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <label className="cursor-pointer text-[10px] text-[var(--color-text-muted)]">
                  <input
                    type="radio"
                    name={`primary-${group.id}`}
                    checked={isPrimary}
                    onChange={() => {
                      setPrimaryId(c.id);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.delete(c.id);
                        return next;
                      });
                    }}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="block">Keep</span>
                </label>
              </div>
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0", avatarColors[colorIdx])}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {c.firstName} {c.lastName}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-background)] text-[var(--color-text-muted)]">
                    {c.status.replace("_", " ")}
                  </span>
                  {c.positionTitle && (
                    <span className="text-[10px] text-[var(--color-text-muted)] truncate">for {c.positionTitle}</span>
                  )}
                  {c.applicationCount > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">{c.applicationCount} applications</span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {c.email}
                  {c.phone && <span className="ml-2">· {c.phone}</span>}
                  {c.source && <span className="ml-2">· via {c.source}</span>}
                  <span className="ml-2">· added {timeAgo(c.createdAt)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.resumeUrl ? (
                  <span title="Resume on file"><Icon name="description" size={14} className="text-emerald-500" /></span>
                ) : c.hasResumeText ? (
                  <span title="Resume text on file"><Icon name="description" size={14} className="text-purple-500" /></span>
                ) : (
                  <Icon name="description" size={14} className="text-[var(--color-text-muted)] opacity-40" />
                )}
                {!isPrimary && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(c.id)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">Merge in</span>
                  </label>
                )}
                {isPrimary && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium">
                    Primary
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 py-2 text-xs text-red-400 bg-red-500/5">{error}</p>}
    </div>
  );
}
