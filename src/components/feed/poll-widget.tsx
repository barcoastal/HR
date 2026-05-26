"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPollVote } from "@/lib/actions/feed";
import { Icon } from "@/components/ui/icon";
import type { PollView } from "@/lib/actions/feed";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function VisibilityBadge({ poll }: { poll: PollView }) {
  const map = {
    OPEN: { icon: "groups", label: "Open vote", tint: "text-emerald-500 bg-emerald-500/10" },
    PUBLIC_ANONYMOUS: { icon: "visibility_off", label: "Anonymous", tint: "text-blue-500 bg-blue-500/10" },
    ADMIN_ANONYMOUS: { icon: "admin_panel_settings", label: "Admin-only results", tint: "text-purple-500 bg-purple-500/10" },
  } as const;
  const m = map[poll.visibility];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", m.tint)}>
      <Icon name={m.icon} size={11} />
      {m.label}
    </span>
  );
}

export function PollWidget({ poll }: { poll: PollView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(poll.myOptionIds);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = poll.myOptionIds.length > 0;
  const isClosed = poll.closesAt ? poll.closesAt.getTime() < Date.now() : false;
  const showResults = !poll.resultsHidden;

  function toggle(optionId: string) {
    if (isClosed) return;
    if (poll.allowMultiple) {
      setSelected((prev) => (prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]));
    } else {
      setSelected([optionId]);
    }
  }

  function handleVote() {
    if (selected.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await submitPollVote(poll.id, selected);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Vote failed");
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{poll.question}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <VisibilityBadge poll={poll} />
            {poll.allowMultiple && (
              <span className="text-[10px] text-[var(--color-text-muted)] px-2 py-0.5 rounded-full bg-[var(--color-surface)]">
                Multiple choice
              </span>
            )}
            {poll.totalVotes !== null && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
              </span>
            )}
            {isClosed && (
              <span className="text-[10px] text-red-400 px-2 py-0.5 rounded-full bg-red-500/10">Closed</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const didVoteThis = poll.myOptionIds.includes(opt.id);
          const pct =
            poll.totalVotes && poll.totalVotes > 0 && opt.voteCount !== null
              ? Math.round((opt.voteCount / poll.totalVotes) * 100)
              : 0;
          const topPct = showResults && poll.totalVotes && poll.totalVotes > 0
            ? Math.max(
                ...poll.options
                  .map((o) => (o.voteCount !== null && poll.totalVotes ? (o.voteCount / poll.totalVotes) * 100 : 0))
              )
            : 0;
          const isLeading = showResults && pct > 0 && Math.abs(pct - topPct) < 0.5;

          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              disabled={isClosed}
              className={cn(
                "w-full relative overflow-hidden rounded-lg border text-left transition-all",
                "px-3 py-2.5",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]",
                isClosed && "cursor-not-allowed opacity-70"
              )}
            >
              {showResults && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all",
                    isLeading ? "bg-[var(--color-accent)]/15" : "bg-[var(--color-accent)]/8"
                  )}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center gap-3">
                <div
                  className={cn(
                    "h-4 w-4 shrink-0 flex items-center justify-center",
                    poll.allowMultiple ? "rounded" : "rounded-full",
                    "border-2",
                    isSelected ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border)]"
                  )}
                >
                  {isSelected && <Icon name="check" size={10} className="text-white" />}
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1">{opt.label}</span>
                {didVoteThis && (
                  <span className="text-[10px] text-[var(--color-accent)] font-medium">You voted</span>
                )}
                {showResults && opt.voteCount !== null && (
                  <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">{pct}%</span>
                )}
              </div>
              {opt.voters && opt.voters.length > 0 && (
                <div className="relative flex items-center gap-1 mt-2 ml-7 flex-wrap">
                  {opt.voters.slice(0, 8).map((v) => {
                    const c = avatarColors[v.firstName.charCodeAt(0) % avatarColors.length];
                    return (
                      <div
                        key={v.id}
                        title={`${v.firstName} ${v.lastName}`}
                        className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]"
                      >
                        {v.profilePhoto ? (
                          <img src={v.profilePhoto} alt="" className="h-4 w-4 rounded-full object-cover" />
                        ) : (
                          <div className={cn("h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px] font-semibold", c)}>
                            {getInitials(v.firstName, v.lastName)}
                          </div>
                        )}
                        <span className="text-[10px] text-[var(--color-text-muted)]">{v.firstName}</span>
                      </div>
                    );
                  })}
                  {opt.voters.length > 8 && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">+{opt.voters.length - 8} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {poll.resultsHidden && (
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
          <Icon name="lock" size={12} />
          Anonymous poll. Results are visible only to super admins.
        </p>
      )}
      {!poll.resultsHidden && poll.visibility === "PUBLIC_ANONYMOUS" && (
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
          <Icon name="visibility_off" size={12} />
          Votes are anonymous. Only the totals are shown.
        </p>
      )}

      {!isClosed && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {hasVoted ? "Your vote is in. You can change it anytime." : poll.allowMultiple ? "Pick one or more." : "Pick one."}
          </p>
          <button
            onClick={handleVote}
            disabled={selected.length === 0 || pending}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {pending ? "Saving…" : hasVoted ? "Update vote" : "Vote"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
