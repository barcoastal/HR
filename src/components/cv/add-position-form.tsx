"use client";

import { cn, getInitials } from "@/lib/utils";
import { Plus, Loader2, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createPosition, pullCandidateToRecruitment } from "@/lib/actions/candidates";
import { aiMatchCandidates, type AIMatch } from "@/lib/actions/ai-match";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string };

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-emerald-500/10 text-emerald-400"
      : score >= 70
        ? "bg-blue-500/10 text-blue-400"
        : "bg-amber-500/10 text-amber-400";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", color)}>
      {score}%
    </span>
  );
}

export function AIMatchDialog({
  positionId,
  positionTitle,
  open,
  onClose,
}: {
  positionId: string;
  positionTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const [matches, setMatches] = useState<AIMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const router = useRouter();

  async function runMatch() {
    if (started) return;
    setStarted(true);
    setLoading(true);
    try {
      const res = await aiMatchCandidates(positionId);
      setMatches(res.sort((a, b) => b.score - a.score));
    } catch {
      setMatches([]);
    }
    setLoading(false);
  }

  // Trigger match when dialog opens
  if (open && !started) {
    runMatch();
  }

  async function handlePull(candidateId: string) {
    setPullingId(candidateId);
    await pullCandidateToRecruitment(candidateId, positionId);
    setMatches((prev) =>
      prev.map((m) => (m.id === candidateId ? { ...m, inPipeline: true } : m))
    );
    setPullingId(null);
  }

  function handleClose() {
    if (started) router.refresh();
    setMatches([]);
    setStarted(false);
    setLoading(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} title="AI Candidate Matching">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {loading ? (
              <>AI is scanning your candidate database for <span className="font-medium text-[var(--color-text-primary)]">{positionTitle}</span>...</>
            ) : (
              <>
                <span className="font-medium text-[var(--color-text-primary)]">{positionTitle}</span>
                {" "}&mdash; {matches.length} match{matches.length !== 1 ? "es" : ""} found.
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-[var(--color-accent)] animate-pulse" />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] animate-pulse">Analyzing skills, experience, and fit...</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {matches.map((m) => {
              const initials = getInitials(m.firstName, m.lastName);
              const colorIdx = m.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <div key={m.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 mt-0.5", avatarColors[colorIdx])}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{m.firstName} {m.lastName}</p>
                      <ScoreBadge score={m.score} />
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      {m.email}{m.experience ? ` · ${m.experience}` : ""}{m.source ? ` · via ${m.source}` : ""}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 italic">{m.reason}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {parseSkills(m.skills).slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {m.inPipeline ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">
                        <Check className="h-3 w-3" />
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handlePull(m.id)}
                        disabled={pullingId === m.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium",
                          "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors",
                          "disabled:opacity-50"
                        )}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        {pullingId === m.id ? "..." : "Pull"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No matching candidates found in the database.</p>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleClose}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]")}
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function AddPositionForm({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "recommendations">("form");
  const [createdPositionId, setCreatedPositionId] = useState<string | null>(null);
  const [createdPositionTitle, setCreatedPositionTitle] = useState("");
  const [form, setForm] = useState({
    title: "",
    departmentId: "",
    description: "",
    requirements: "",
    salary: "",
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.title) return;
    setLoading(true);
    const position = await createPosition({
      title: form.title,
      departmentId: form.departmentId || undefined,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      salary: form.salary || undefined,
    });
    setCreatedPositionId(position.id);
    setCreatedPositionTitle(form.title);
    setStep("recommendations");
    setLoading(false);
  }

  function handleClose() {
    if (step === "recommendations") {
      router.refresh();
    }
    setOpen(false);
    setStep("form");
    setForm({ title: "", departmentId: "", description: "", requirements: "", salary: "" });
    setCreatedPositionId(null);
    setCreatedPositionTitle("");
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "hover:bg-[var(--color-surface-hover)] transition-colors"
        )}
      >
        <Plus className="h-4 w-4" />
        Add Position
      </button>

      {step === "form" && (
        <Dialog open={open} onClose={handleClose} title="New Position">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Title *</label>
              <input value={form.title} onChange={(e) => update("title", e.target.value)} className={inputClass} placeholder="Senior React Developer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Department</label>
              <select value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} className={inputClass}>
                <option value="">Select department...</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} className={cn(inputClass, "resize-none")} placeholder="Role description..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Requirements (used to find matching candidates)</label>
              <textarea value={form.requirements} onChange={(e) => update("requirements", e.target.value)} rows={2} className={cn(inputClass, "resize-none")} placeholder="React, TypeScript, Node.js, 5+ years..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Salary Range</label>
              <input value={form.salary} onChange={(e) => update("salary", e.target.value)} className={inputClass} placeholder="$80k - $120k" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!form.title || loading}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Find Matches"}
            </button>
          </div>
        </Dialog>
      )}

      {step === "recommendations" && createdPositionId && (
        <AIMatchDialog
          positionId={createdPositionId}
          positionTitle={createdPositionTitle}
          open={open}
          onClose={handleClose}
        />
      )}
    </>
  );
}
