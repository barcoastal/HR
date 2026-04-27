"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createPosition, pullCandidateToRecruitment } from "@/lib/actions/candidates";
import { aiMatchCandidates, type AIMatch } from "@/lib/actions/ai-match";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { JobPostingPreview } from "@/components/cv/job-posting-preview";

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
  const [previewResume, setPreviewResume] = useState<{ url: string; name: string } | null>(null);
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
          <Icon name="auto_awesome" size={16} className="text-[var(--color-accent)]" />
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
              <Icon name="auto_awesome" className="text-[var(--color-accent)] animate-pulse" />
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
                  <div className="shrink-0 flex items-center gap-1.5">
                    {m.resumeUrl && (
                      <button
                        onClick={() => setPreviewResume({ url: m.resumeUrl!, name: `${m.firstName} ${m.lastName}` })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] transition-colors"
                        title="Preview resume"
                      >
                        <Icon name="description" size={12} />
                        Resume
                      </button>
                    )}
                    {m.inPipeline ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">
                        <Icon name="check" size={12} />
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
                        <Icon name="open_in_new" size={12} />
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

      {previewResume && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewResume(null)}
        >
          <div
            className="bg-[var(--color-surface)] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="description" size={16} className="text-[var(--color-accent)] shrink-0" />
                <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{previewResume.name} — Resume</span>
              </div>
              <button
                onClick={() => setPreviewResume(null)}
                className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <iframe src={previewResume.url} className="flex-1 w-full" title={previewResume.name} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
        checked ? color : "bg-[var(--color-border)]"
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
        checked ? "translate-x-4.5" : "translate-x-0.5"
      )} />
    </button>
  );
}

export function AddPositionForm({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "preview" | "recommendations">("form");
  const [createdPositionId, setCreatedPositionId] = useState<string | null>(null);
  const [createdPositionTitle, setCreatedPositionTitle] = useState("");

  // Platform toggles
  const [postToJobing, setPostToJobing] = useState(true);
  const [postToBreezy, setPostToBreezy] = useState(true);

  const [postToCareers, setPostToCareers] = useState(true);
  const [breezyTitle, setBreezyTitle] = useState("");
  const [showMatchDialog, setShowMatchDialog] = useState(false);

  const [form, setForm] = useState({
    title: "",
    departmentId: "",
    description: "",
    requirements: "",
    salary: "",
    location: "",
    type: "Full-time",
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePreview() {
    if (!form.title) return;
    if (postToBreezy) {
      setStep("preview");
    } else {
      handlePublish();
    }
  }

  const [error, setError] = useState("");
  const [postingWarnings, setPostingWarnings] = useState<string[]>([]);

  async function handlePublish() {
    if (!form.title) return;
    setLoading(true);
    setError("");
    setPostingWarnings([]);
    try {
      const result = await createPosition({
        title: form.title,
        departmentId: form.departmentId || undefined,
        description: form.description || undefined,
        requirements: form.requirements || undefined,
        salary: form.salary || undefined,
        location: form.location || undefined,
        type: form.type || undefined,
        published: postToCareers,
        postToJobing,
        postToBreezy,
        breezyTitleOverride: breezyTitle.trim() || null,
      });
      setCreatedPositionId(result.id);
      setCreatedPositionTitle(form.title);
      if (result.postingErrors && result.postingErrors.length > 0) {
        setPostingWarnings(result.postingErrors);
      }
      setStep("recommendations");
    } catch (err) {
      console.error("[add-position] Failed to create position:", err);
      setError(err instanceof Error ? err.message : "Failed to create position. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (step === "recommendations") {
      router.refresh();
    }
    setOpen(false);
    setStep("form");
    setForm({ title: "", departmentId: "", description: "", requirements: "", salary: "", location: "", type: "Full-time" });
    setCreatedPositionId(null);
    setCreatedPositionTitle("");
    setPostToBreezy(true);
    setBreezyTitle("");
    setLoading(false);
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
        <Icon name="add" size={16} />
        Add Position
      </button>

      {step === "form" && (
        <Dialog open={open} onClose={handleClose} title="New Position">
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Basic fields */}
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
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Requirements</label>
              <textarea value={form.requirements} onChange={(e) => update("requirements", e.target.value)} rows={2} className={cn(inputClass, "resize-none")} placeholder="React, TypeScript, Node.js, 5+ years..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Salary Range</label>
                <input value={form.salary} onChange={(e) => update("salary", e.target.value)} className={inputClass} placeholder="$80k - $120k" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Job Type</label>
                <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputClass}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Location</label>
              <input value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} placeholder="Fort Lauderdale, FL / Remote" />
            </div>

            {/* Publish To section */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
                <Icon name="public" size={14} />
                Publish To
              </p>

              {/* Careers Page */}
              <div className={cn("rounded-lg border mb-2 transition-colors", postToCareers ? "border-[#3052FF]/40 bg-[#3052FF]/5" : "border-[var(--color-border)]")}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-[#3052FF] flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">CD</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">Careers Page</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Show on coastaldebt.com/careers</p>
                    </div>
                  </div>
                  <Toggle checked={postToCareers} onChange={() => setPostToCareers(!postToCareers)} color="bg-[#3052FF]" />
                </div>
              </div>

              {/* Breezy (LinkedIn + Indeed) */}
              <div className={cn("rounded-lg border mb-2 transition-colors", postToBreezy ? "border-[#0A66C2]/40 bg-[#0A66C2]/5" : "border-[var(--color-border)]")}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-[#0A66C2] flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">Bz</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">Breezy (LinkedIn + Indeed)</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Publishes to LinkedIn & Indeed via Breezy HR</p>
                    </div>
                  </div>
                  <Toggle checked={postToBreezy} onChange={() => setPostToBreezy(!postToBreezy)} color="bg-[#0A66C2]" />
                </div>
                {postToBreezy && (
                  <div className="px-3 pb-3 pt-1 border-t border-[#0A66C2]/10 space-y-2">
                    <div>
                      <label className="text-[10px] text-[var(--color-text-muted)] mb-0.5 block">Title shown on LinkedIn / Indeed</label>
                      <input
                        value={breezyTitle}
                        onChange={(e) => setBreezyTitle(e.target.value)}
                        placeholder={form.title ? `Default: ${form.title}` : "Job title for Breezy"}
                        className={cn(inputClass, "text-xs py-1.5")}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Jobing */}
              <div className={cn("rounded-lg border transition-colors", postToJobing ? "border-orange-500/40 bg-orange-500/5" : "border-[var(--color-border)]")}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">JB</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">Jobing</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Publish on pro.jobing.com</p>
                    </div>
                  </div>
                  <Toggle checked={postToJobing} onChange={() => setPostToJobing(!postToJobing)} color="bg-orange-500" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button
              onClick={handlePreview}
              disabled={!form.title || loading}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
            >
              {loading ? (
                <Icon name="progress_activity" size={16} className="animate-material-spin" />
              ) : postToBreezy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="visibility" size={16} />
                  Preview Posting
                </span>
              ) : (
                "Create & Find Matches"
              )}
            </button>
          </div>
        </Dialog>
      )}

      {step === "preview" && (
        <Dialog open={open} onClose={handleClose} title="Preview Job Posting">
          <JobPostingPreview
            job={{
              title: breezyTitle.trim() || form.title,
              description: form.description,
              requirements: form.requirements,
              salary: form.salary,
              departmentName: departments.find((d) => d.id === form.departmentId)?.name || "",
            }}
            showLinkedIn={postToBreezy}
            showIndeed={postToBreezy}
            onBack={() => setStep("form")}
            onPublish={handlePublish}
            publishing={loading}
          />
        </Dialog>
      )}

      {step === "recommendations" && createdPositionId && (
        <Dialog open={open} onClose={handleClose} title="Position Created">
          <div className="space-y-4">
            {postingWarnings.length > 0 && (
              <>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Position created. Some platforms had issues:
                </p>
                {postingWarnings.map((w, i) => (
                  <div key={i} className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                    {w}
                  </div>
                ))}
              </>
            )}
            {postingWarnings.length === 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Icon name="check_circle" size={20} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-700">{createdPositionTitle} is live</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">You can run AI matching anytime from the position&rsquo;s sparkle icon.</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                Done
              </button>
              <button
                onClick={() => { /* user opted in — show match dialog */ setShowMatchDialog(true); }}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2", "bg-purple-500 text-white hover:bg-purple-600")}
              >
                <Icon name="auto_awesome" size={14} />
                Run AI matching now
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {showMatchDialog && createdPositionId && (
        <AIMatchDialog
          positionId={createdPositionId}
          positionTitle={createdPositionTitle}
          open={true}
          onClose={() => { setShowMatchDialog(false); handleClose(); }}
        />
      )}
    </>
  );
}
