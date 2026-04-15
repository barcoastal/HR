"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  getBoardPostings,
  postToBoard,
  pauseOnBoard,
  resumeOnBoard,
  setBoardTitleOverride,
  type BoardName,
  type BoardPostingView,
} from "@/lib/actions/board-postings";

const BOARD_META: Record<BoardName, { label: string; icon: string; color: string }> = {
  CAREERS: { label: "Our Careers page", icon: "public", color: "text-purple-500" },
  INDEED: { label: "Indeed", icon: "work", color: "text-blue-500" },
  BREEZY: { label: "Breezy HR", icon: "work", color: "text-teal-500" },
  JOBING: { label: "Jobing", icon: "work", color: "text-orange-500" },
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-600",
  PAUSED: "bg-amber-500/10 text-amber-700",
  FAILED: "bg-red-500/10 text-red-700",
  NOT_POSTED: "bg-gray-500/10 text-gray-600",
};

export function BoardPostingsPanel({ positionId, defaultTitle }: { positionId: string; defaultTitle: string }) {
  const router = useRouter();
  const [postings, setPostings] = useState<BoardPostingView[] | null>(null);
  const [busyBoard, setBusyBoard] = useState<BoardName | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const data = await getBoardPostings(positionId);
    setPostings(data);
  }, [positionId]);

  useEffect(() => {
    if (open && !postings) load();
  }, [open, postings, load]);

  async function run(action: "post" | "pause" | "resume", board: BoardName) {
    // For Indeed/Breezy, confirm the title to use on first post (or when re-posting without an override set)
    if (action === "post" && (board === "INDEED" || board === "BREEZY")) {
      const current = postings?.find((p) => p.board === board);
      const existingTitle = current?.titleOverride || "";
      const next = prompt(
        `Title to post on ${BOARD_META[board].label}:\n\n(Shown to applicants. Leave as-is to use the position default.)`,
        existingTitle || defaultTitle
      );
      if (next === null) return; // cancelled
      const normalized = next.trim() === defaultTitle.trim() ? null : next.trim() || null;
      await setBoardTitleOverride(positionId, board, normalized);
    }

    setBusyBoard(board);
    const fn = action === "post" ? postToBoard : action === "pause" ? pauseOnBoard : resumeOnBoard;
    const r = await fn(positionId, board);
    if (!r.success) alert(r.error || "Action failed");
    await load();
    setBusyBoard(null);
    router.refresh();
  }

  const summary = postings
    ? postings.filter((p) => p.status === "PUBLISHED").length
    : 0;

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg"
      >
        <span className="flex items-center gap-2">
          <Icon name="campaign" size={14} className="text-[var(--color-accent)]" />
          Job boards
          {postings && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              · {summary} published
            </span>
          )}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} size={14} className="text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {postings === null && (
            <p className="text-[11px] text-[var(--color-text-muted)] py-2">Loading…</p>
          )}
          {postings?.map((p) => {
            const meta = BOARD_META[p.board];
            const badge = STATUS_BADGE[p.status] || STATUS_BADGE.NOT_POSTED;
            const busy = busyBoard === p.board;
            const readonly = p.board === "JOBING";
            const supportsTitleOverride = p.board === "INDEED" || p.board === "BREEZY";
            const displayTitle = p.titleOverride || defaultTitle;
            return (
              <div key={p.board} className="flex flex-wrap items-center gap-3 px-2 py-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                <Icon name={meta.icon} size={14} className={cn(meta.color, "shrink-0")} />
                <span className="text-xs font-medium text-[var(--color-text-primary)] w-24 shrink-0">{meta.label}</span>
                {supportsTitleOverride && (
                  <button
                    onClick={async () => {
                      const current = p.titleOverride || "";
                      const next = prompt(`Title used when posting to ${meta.label}:\n\n(Leave blank to use the position's default title: "${defaultTitle}")`, current);
                      if (next === null) return;
                      await setBoardTitleOverride(positionId, p.board, next || null);
                      await load();
                    }}
                    className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline decoration-dotted truncate max-w-[200px] flex items-center gap-1"
                    title="Click to change"
                  >
                    <Icon name="edit" size={10} />
                    {displayTitle}
                    {p.titleOverride && <span className="text-purple-500">*</span>}
                  </button>
                )}
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", badge)}>
                  {p.status.replace("_", " ")}
                </span>
                {p.lastError && (
                  <span className="text-[10px] text-red-600 truncate max-w-[200px]" title={p.lastError}>
                    {p.lastError}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {readonly && (
                    <span className="text-[10px] text-[var(--color-text-muted)] italic">Read-only API</span>
                  )}
                  {!readonly && p.status === "NOT_POSTED" && (
                    <button
                      onClick={() => run("post", p.board)}
                      disabled={busy}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {busy ? <Icon name="progress_activity" size={10} className="animate-material-spin" /> : <Icon name="upload" size={10} />}
                      Post
                    </button>
                  )}
                  {!readonly && p.status === "PUBLISHED" && (
                    <>
                      <button
                        onClick={() => run("pause", p.board)}
                        disabled={busy}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1"
                      >
                        {busy ? <Icon name="progress_activity" size={10} className="animate-material-spin" /> : <Icon name="pause" size={10} />}
                        Pause
                      </button>
                      <button
                        onClick={() => run("post", p.board)}
                        disabled={busy}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--color-background)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
                        title="Re-post (creates a new listing)"
                      >
                        <Icon name="refresh" size={10} />
                      </button>
                    </>
                  )}
                  {!readonly && p.status === "PAUSED" && (
                    <>
                      <button
                        onClick={() => run("resume", p.board)}
                        disabled={busy}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1"
                      >
                        {busy ? <Icon name="progress_activity" size={10} className="animate-material-spin" /> : <Icon name="play_arrow" size={10} />}
                        Resume
                      </button>
                    </>
                  )}
                  {!readonly && p.status === "FAILED" && (
                    <button
                      onClick={() => run("post", p.board)}
                      disabled={busy}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1"
                    >
                      {busy ? <Icon name="progress_activity" size={10} className="animate-material-spin" /> : <Icon name="refresh" size={10} />}
                      Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
