"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { updatePosition } from "@/lib/actions/candidates";
import {
  getBoardPostings,
  postToBoard,
  pauseOnBoard,
  resumeOnBoard,
  setBoardTitleOverride,
  type BoardName,
  type BoardPostingView,
} from "@/lib/actions/board-postings";

type Department = { id: string; name: string };

const BOARD_META: Record<BoardName, {
  label: string;
  subtitle: string;
  initials: string;
  bg: string;
  tint: string;
  ring: string;
  tintBg: string;
}> = {
  CAREERS: {
    label: "Our Careers page",
    subtitle: "Publish on /careers",
    initials: "CR",
    bg: "bg-purple-500",
    tint: "border-purple-500/40 bg-purple-500/5",
    ring: "bg-purple-500",
    tintBg: "border-purple-500/10",
  },
  BREEZY: {
    label: "Breezy (LinkedIn + Indeed)",
    subtitle: "Publishes to LinkedIn & Indeed via Breezy",
    initials: "Bz",
    bg: "bg-[#0a66c2]",
    tint: "border-[#0a66c2]/40 bg-[#0a66c2]/5",
    ring: "bg-[#0a66c2]",
    tintBg: "border-[#0a66c2]/10",
  },
  JOBING: {
    label: "Jobing",
    subtitle: "Read-only API — manage in pro.jobing",
    initials: "JB",
    bg: "bg-orange-500",
    tint: "border-orange-500/40 bg-orange-500/5",
    ring: "bg-orange-500",
    tintBg: "border-orange-500/10",
  },
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-600",
  PAUSED: "bg-amber-500/10 text-amber-700",
  FAILED: "bg-red-500/10 text-red-700",
  NOT_POSTED: "bg-gray-500/10 text-gray-600",
};

export function EditPositionDialog({
  open,
  onClose,
  position,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  position: {
    id: string;
    title: string;
    description: string | null;
    requirements: string | null;
    salary: string | null;
    location: string | null;
    type: string | null;
    departmentId: string | null;
  };
  departments: Department[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: position.title,
    description: position.description || "",
    requirements: position.requirements || "",
    salary: position.salary || "",
    location: position.location || "",
    type: position.type || "",
    departmentId: position.departmentId || "",
  });
  const [saving, setSaving] = useState(false);
  const [postings, setPostings] = useState<BoardPostingView[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busyBoard, setBusyBoard] = useState<BoardName | null>(null);

  const load = useCallback(async () => {
    const data = await getBoardPostings(position.id);
    setPostings(data);
    const o: Record<string, string> = {};
    for (const p of data) {
      if (p.titleOverride) o[p.board] = p.titleOverride;
    }
    setOverrides(o);
  }, [position.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    setForm({
      title: position.title,
      description: position.description || "",
      requirements: position.requirements || "",
      salary: position.salary || "",
      location: position.location || "",
      type: position.type || "",
      departmentId: position.departmentId || "",
    });
  }, [position]);

  async function handleSave() {
    setSaving(true);
    await updatePosition(position.id, {
      title: form.title.trim() || position.title,
      description: form.description.trim() || null,
      requirements: form.requirements.trim() || null,
      salary: form.salary.trim() || null,
      location: form.location.trim() || null,
      type: form.type.trim() || null,
      departmentId: form.departmentId || null,
    });
    // Persist any changed overrides
    for (const p of postings) {
      if (p.board === "CAREERS" || p.board === "JOBING") continue;
      const newVal = overrides[p.board]?.trim() || null;
      if ((p.titleOverride || null) !== newVal) {
        await setBoardTitleOverride(position.id, p.board, newVal);
      }
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function run(action: "post" | "pause" | "resume", board: BoardName) {
    setBusyBoard(board);
    // Save title override first if set
    if (board === "BREEZY" && overrides[board] !== undefined) {
      await setBoardTitleOverride(position.id, board, overrides[board]?.trim() || null);
    }
    const fn = action === "post" ? postToBoard : action === "pause" ? pauseOnBoard : resumeOnBoard;
    const r = await fn(position.id, board);
    if (!r.success) alert(r.error || "Action failed");
    await load();
    setBusyBoard(null);
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
  );

  return (
    <Dialog open={open} onClose={onClose} title="Edit position">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Core fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Department</label>
            <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} className={inputClass}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Type</label>
            <input placeholder="Full-time, Part-time, Contract…" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Salary</label>
            <input placeholder="$60k–$80k" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Location</label>
            <input placeholder="Remote, Fort Lauderdale…" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Requirements</label>
            <textarea rows={3} value={form.requirements} onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))} className={inputClass} />
          </div>
        </div>

        {/* Board postings — styled like AddPositionForm */}
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-2">Post & re-post to job boards</p>
          <div className="space-y-2">
            {postings.map((p) => {
              const meta = BOARD_META[p.board];
              const supportsOverride = p.board === "BREEZY";
              const busy = busyBoard === p.board;
              const readonly = p.board === "JOBING";
              const active = p.status === "PUBLISHED" || p.status === "PAUSED";
              return (
                <div key={p.board} className={cn("rounded-lg border transition-colors", active ? meta.tint : "border-[var(--color-border)]")}>
                  <div className="flex items-center justify-between p-3 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", meta.bg)}>
                        <span className="text-white text-[10px] font-bold">{meta.initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{meta.label}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{meta.subtitle}</p>
                      </div>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", STATUS_BADGE[p.status] || STATUS_BADGE.NOT_POSTED)}>
                      {p.status.replace("_", " ")}
                    </span>
                  </div>
                  {(active || supportsOverride || p.lastError || !readonly) && (
                    <div className={cn("px-3 pb-3 pt-1 border-t space-y-2", meta.tintBg)}>
                      {supportsOverride && (
                        <div>
                          <label className="text-[10px] text-[var(--color-text-muted)] mb-0.5 block">Title shown on {meta.label}</label>
                          <input
                            value={overrides[p.board] ?? ""}
                            onChange={(e) => setOverrides((o) => ({ ...o, [p.board]: e.target.value }))}
                            placeholder={`Default: ${form.title}`}
                            className={cn(inputClass, "text-xs py-1.5")}
                          />
                        </div>
                      )}
                      {p.lastError && (
                        <p className="text-[10px] text-red-600 truncate" title={p.lastError}>{p.lastError}</p>
                      )}
                      {readonly ? (
                        <p className="text-[10px] text-[var(--color-text-muted)] italic">Jobing API is read-only — manage this listing in the pro.jobing dashboard.</p>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.status === "NOT_POSTED" && (
                            <button
                              onClick={() => run("post", p.board)}
                              disabled={busy}
                              className={cn("px-2.5 py-1 rounded text-[11px] font-medium text-white flex items-center gap-1 disabled:opacity-50", meta.ring)}
                            >
                              {busy && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
                              <Icon name="upload" size={10} /> Post now
                            </button>
                          )}
                          {p.status === "PUBLISHED" && (
                            <>
                              <button
                                onClick={() => run("pause", p.board)}
                                disabled={busy}
                                className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 flex items-center gap-1"
                              >
                                {busy && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
                                <Icon name="pause" size={10} /> Pause
                              </button>
                              <button
                                onClick={() => run("post", p.board)}
                                disabled={busy}
                                className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center gap-1"
                              >
                                <Icon name="refresh" size={10} /> Re-post
                              </button>
                            </>
                          )}
                          {p.status === "PAUSED" && (
                            <button
                              onClick={() => run("resume", p.board)}
                              disabled={busy}
                              className="px-2.5 py-1 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 flex items-center gap-1"
                            >
                              {busy && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
                              <Icon name="play_arrow" size={10} /> Resume
                            </button>
                          )}
                          {p.status === "FAILED" && (
                            <button
                              onClick={() => run("post", p.board)}
                              disabled={busy}
                              className="px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 flex items-center gap-1"
                            >
                              {busy && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
                              <Icon name="refresh" size={10} /> Retry
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Icon name="progress_activity" size={14} className="animate-material-spin" />}
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
}
