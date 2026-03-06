"use client";

import { cn, getInitials } from "@/lib/utils";
import { Plus, Loader2, ArrowUpRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createPosition, findMatchingCandidates, pullCandidateToRecruitment } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string };

type MatchedCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string | null;
  experience: string | null;
  source: string | null;
  inPipeline: boolean;
};

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function AddPositionForm({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "recommendations">("form");
  const [createdPositionId, setCreatedPositionId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchedCandidate[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);
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

    // Build keywords from title + requirements
    const keywords = [
      ...form.title.split(/[\s,;/]+/).filter((w) => w.length > 2),
      ...form.requirements.split(/[\s,;/]+/).filter((w) => w.length > 2),
    ];
    const uniqueKeywords = [...new Set(keywords.map((k) => k.toLowerCase()))];

    if (uniqueKeywords.length > 0) {
      setMatchLoading(true);
      setStep("recommendations");
      const res = await findMatchingCandidates(uniqueKeywords);
      setMatches(res as MatchedCandidate[]);
      setMatchLoading(false);
    } else {
      setLoading(false);
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  async function handlePull(candidateId: string) {
    if (!createdPositionId) return;
    setPullingId(candidateId);
    await pullCandidateToRecruitment(candidateId, createdPositionId);
    setMatches((prev) =>
      prev.map((m) => (m.id === candidateId ? { ...m, inPipeline: true } : m))
    );
    setPullingId(null);
  }

  function handleClose() {
    if (step === "recommendations") {
      router.refresh();
    }
    setOpen(false);
    setStep("form");
    setForm({ title: "", departmentId: "", description: "", requirements: "", salary: "" });
    setMatches([]);
    setCreatedPositionId(null);
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

      <Dialog open={open} onClose={handleClose} title={step === "form" ? "New Position" : "Recommended Candidates"}>
        {step === "form" && (
          <>
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
          </>
        )}

        {step === "recommendations" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                Position <span className="font-medium text-[var(--color-text-primary)]">{form.title}</span> created. {matchLoading ? "Searching database..." : `${matches.length} potential match${matches.length !== 1 ? "es" : ""} found.`}
              </p>
            </div>

            {matchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
              </div>
            ) : matches.length > 0 ? (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {matches.map((m) => {
                  const initials = getInitials(m.firstName, m.lastName);
                  const colorIdx = m.firstName.charCodeAt(0) % avatarColors.length;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", avatarColors[colorIdx])}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{m.firstName} {m.lastName}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                          {m.email}{m.experience ? ` · ${m.experience}` : ""}{m.source ? ` · via ${m.source}` : ""}
                        </p>
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
        )}
      </Dialog>
    </>
  );
}
