"use client";

import React from "react";
import { cn, formatDate } from "@/lib/utils";
import { Search, Download, ArrowUpRight, FileText, Check, ChevronDown, ChevronUp, Mail, Phone, Linkedin, Briefcase, Save, Loader2, Pencil } from "lucide-react";
import { useState, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { pullCandidateToRecruitment, updateCandidateNotes } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";

type CandidateItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  skills: string | null;
  experience: string | null;
  source: string | null;
  notes: string | null;
  resumeUrl: string | null;
  resumeText: string | null;
  inPipeline: boolean;
  status: CandidateStatus;
  positionId: string | null;
  jobAppliedTo: string | null;
  position: { title: string } | null;
  createdAt: Date;
};

type Position = { id: string; title: string };

type Props = {
  candidates: CandidateItem[];
  positions: Position[];
};

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

function NotesEditor({ candidateId, initialNotes }: { candidateId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasChanged = notes !== (initialNotes || "");

  async function handleSave() {
    setSaving(true);
    await updateCandidateNotes(candidateId, notes);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Notes</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={!hasChanged || saving}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors",
              hasChanged && !saving
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        rows={4}
        placeholder="Write notes about this candidate here..."
        className={cn(
          "w-full px-3 py-2 rounded-lg text-sm",
          "bg-white dark:bg-[var(--color-background)] border-2 border-[var(--color-border)]",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
        )}
      />
    </div>
  );
}

function ResumeViewer({ resumeUrl, candidateName }: { resumeUrl: string; candidateName: string }) {
  // Local resumes use /api/resumes/{id}, Jobing URLs need the proxy
  const isLocal = resumeUrl.startsWith("/api/resumes/");
  const pdfSrc = isLocal
    ? resumeUrl
    : `/api/platforms/jobing/resume?url=${encodeURIComponent(resumeUrl)}`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <p className="text-xs font-semibold text-[var(--color-text-primary)]">Resume PDF</p>
        <a
          href={pdfSrc}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium ml-auto",
            "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
          )}
        >
          <Download className="h-3 w-3" />
          Download PDF
        </a>
      </div>
      <iframe
        src={pdfSrc}
        className="w-full rounded-lg border-2 border-[var(--color-border)]"
        style={{ height: "600px" }}
        title={`${candidateName} Resume`}
      />
    </div>
  );
}

export function CandidateDatabase({ candidates, positions }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [selectedPosition, setSelectedPosition] = useState("");
  const [pulling, setPulling] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const distinctSources = useMemo(() => {
    const sources = new Set<string>();
    for (const c of candidates) {
      if (c.source) sources.add(c.source);
    }
    return Array.from(sources).sort();
  }, [candidates]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.skills && c.skills.toLowerCase().includes(q)) ||
          (c.experience && c.experience.toLowerCase().includes(q)) ||
          (c.jobAppliedTo && c.jobAppliedTo.toLowerCase().includes(q)) ||
          (c.resumeText && c.resumeText.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [candidates, search, sourceFilter]);

  function openPullDialog(candidate: CandidateItem) {
    setSelectedCandidate(candidate);
    setSelectedPosition("");
    setPullDialogOpen(true);
  }

  async function handlePull() {
    if (!selectedCandidate) return;
    setPulling(true);
    await pullCandidateToRecruitment(
      selectedCandidate.id,
      selectedPosition || undefined
    );
    setPulling(false);
    setPullDialogOpen(false);
    setSelectedCandidate(null);
    router.refresh();
  }

  const inputClass = cn(
    "px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-surface)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, skills, or resume content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(inputClass, "w-full pl-9")}
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className={inputClass}
        >
          <option value="">All Sources</option>
          {distinctSources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Source</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Job Applied</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Resume</th>
              <th className="text-right text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isExpanded = expandedId === c.id;
              const skills = parseSkills(c.skills);
              return (
                <React.Fragment key={c.id}>
                  <tr
                    className={cn(
                      "border-b border-[var(--color-border)] hover:bg-[var(--color-border)]/30 transition-colors cursor-pointer",
                      isExpanded && "bg-[var(--color-border)]/20"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0" />
                        )}
                        <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {c.firstName} {c.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{c.phone || "\u2014"}</td>
                    <td className="px-4 py-3">
                      {c.source && (
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-medium",
                          c.source === "pro.jobing"
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-blue-500/10 text-blue-400"
                        )}>
                          {c.source}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] max-w-[160px] truncate">
                      {c.jobAppliedTo || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {c.resumeUrl && (
                          <a
                            href={`/api/platforms/jobing/resume?url=${encodeURIComponent(c.resumeUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                              "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                            )}
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        )}
                        {c.resumeText && (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                            "bg-purple-500/10 text-purple-400"
                          )}>
                            <FileText className="h-3 w-3" />
                            Text
                          </span>
                        )}
                        {!c.resumeUrl && !c.resumeText && (
                          <span className="text-xs text-[var(--color-text-muted)]">{"\u2014"}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.inPipeline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400">
                          <Check className="h-3 w-3" />
                          In Pipeline
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); openPullDialog(c); }}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                            "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                          )}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          Pull to Recruitment
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-[var(--color-border)]">
                      <td colSpan={8} className="px-6 py-5 bg-[var(--color-background)]">
                        <div className="space-y-5">
                          {/* Contact & Skills */}
                          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span>{c.email}</span>
                            </div>
                            {c.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{c.phone}</span>
                              </div>
                            )}
                            {c.linkedinUrl && (
                              <div className="flex items-center gap-2">
                                <Linkedin className="h-3.5 w-3.5 shrink-0" />
                                <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline truncate">
                                  LinkedIn Profile
                                </a>
                              </div>
                            )}
                            {c.experience && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span>{c.experience}</span>
                              </div>
                            )}
                            {c.position && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span>Position: {c.position.title}</span>
                              </div>
                            )}
                            {c.jobAppliedTo && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                                <span className="font-medium text-[var(--color-text-primary)]">Applied for: {c.jobAppliedTo}</span>
                              </div>
                            )}
                          </div>

                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {skills.map((s) => (
                                <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{s}</span>
                              ))}
                            </div>
                          )}

                          {/* Notes Editor — always visible */}
                          <NotesEditor candidateId={c.id} initialNotes={c.notes} />

                          {/* PDF Resume Viewer — auto-shown */}
                          {c.resumeUrl ? (
                            <ResumeViewer resumeUrl={c.resumeUrl} candidateName={`${c.firstName} ${c.lastName}`} />
                          ) : (
                            <p className="text-xs text-[var(--color-text-muted)] italic">No resume PDF available for this candidate.</p>
                          )}

                          {/* Resume Text */}
                          {c.resumeText && (
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">Parsed Resume Text</p>
                              <div className="max-h-48 overflow-y-auto rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-3">
                                <pre className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap font-sans leading-relaxed">
                                  {c.resumeText}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No candidates found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={pullDialogOpen} onClose={() => setPullDialogOpen(false)} title="Pull to Recruitment">
        {selectedCandidate && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Add <span className="font-medium text-[var(--color-text-primary)]">{selectedCandidate.firstName} {selectedCandidate.lastName}</span> to the recruitment pipeline?
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                Assign to Position (optional)
              </label>
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className={cn(inputClass, "w-full")}
              >
                <option value="">No position</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPullDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePull}
                disabled={pulling}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-[var(--color-accent)] text-white",
                  "hover:bg-[var(--color-accent-hover)]",
                  "disabled:opacity-50"
                )}
              >
                {pulling ? "Pulling..." : "Pull to Pipeline"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
