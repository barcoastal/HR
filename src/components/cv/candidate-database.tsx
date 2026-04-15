"use client";

import React from "react";
import { cn, formatDate } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { pullCandidateToRecruitment, updateCandidateNotes } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { Icon } from "@/components/ui/icon";

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
  doNotCall?: boolean;
  doNotCallReason?: string | null;
  applicationCount?: number;
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

function ResizableTh({
  label,
  colKey,
  startResize,
  align = "left",
}: {
  label: string;
  colKey: string;
  startResize: (key: string, e: React.MouseEvent) => void;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("text-xs font-medium text-[var(--color-text-muted)] px-4 py-3 relative select-none", align === "right" ? "text-right" : "text-left")}>
      {label}
      <div
        onMouseDown={(e) => startResize(colKey, e)}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--color-accent)]/40 active:bg-[var(--color-accent)]"
        title="Drag to resize"
      />
    </th>
  );
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
          <Icon name="edit" size={12} className="text-[var(--color-accent)]" />
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Notes</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Icon name="check" size={12} /> Saved
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
            {saving ? <Icon name="progress_activity" size={12} className="animate-material-spin" /> : <Icon name="save" size={12} />}
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
          "bg-[var(--color-background)] border-2 border-[var(--color-border)]",
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
        <Icon name="description" size={12} className="text-[var(--color-accent)]" />
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
          <Icon name="download" size={12} />
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
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // "", "7", "30", "90"
  const [resumeFilter, setResumeFilter] = useState(""); // "", "with", "without"
  const [pipelineFilter, setPipelineFilter] = useState(""); // "", "in", "out"
  const [dncFilter, setDncFilter] = useState(""); // "", "yes", "no"
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    name: 240,
    email: 220,
    phone: 140,
    source: 110,
    job: 180,
    date: 120,
    resume: 130,
    action: 170,
  });
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cv-db-col-widths");
      if (saved) setColWidths((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resizingRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      const next = Math.max(80, r.startW + delta);
      setColWidths((prev) => ({ ...prev, [r.key]: next }));
    }
    function onUp() {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = "";
        try {
          localStorage.setItem("cv-db-col-widths", JSON.stringify(colWidths));
        } catch { /* ignore */ }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [colWidths]);

  function startResize(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] ?? 150 };
    document.body.style.cursor = "col-resize";
  }
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

  const positionLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of positions) m.set(p.title.toLowerCase(), p.id);
    return m;
  }, [positions]);

  const activeFilterCount =
    [sourceFilter, positionFilter, statusFilter, dateFilter, resumeFilter, pipelineFilter, dncFilter].filter((x) => x).length;

  const filtered = useMemo(() => {
    const now = Date.now();
    const dateCutoff = dateFilter ? now - parseInt(dateFilter, 10) * 24 * 60 * 60 * 1000 : null;

    return candidates.filter((c) => {
      if (sourceFilter && c.source !== sourceFilter) return false;

      if (positionFilter) {
        // Match against either the linked positionId or the jobAppliedTo text
        const matchById = c.positionId === positionFilter;
        const targetTitle = positions.find((p) => p.id === positionFilter)?.title?.toLowerCase();
        const matchByText = targetTitle && c.jobAppliedTo && c.jobAppliedTo.toLowerCase().includes(targetTitle);
        if (!matchById && !matchByText) return false;
      }

      if (statusFilter && c.status !== statusFilter) return false;

      if (dateCutoff !== null) {
        const created = new Date(c.createdAt).getTime();
        if (created < dateCutoff) return false;
      }

      if (resumeFilter === "with" && !c.resumeUrl) return false;
      if (resumeFilter === "without" && c.resumeUrl) return false;

      if (pipelineFilter === "in" && !c.inPipeline) return false;
      if (pipelineFilter === "out" && c.inPipeline) return false;

      if (dncFilter === "yes" && !c.doNotCall) return false;
      if (dncFilter === "no" && c.doNotCall) return false;

      if (search) {
        const q = search.toLowerCase().trim();
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const match =
          fullName.includes(q) ||
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.skills && c.skills.toLowerCase().includes(q)) ||
          (c.experience && c.experience.toLowerCase().includes(q)) ||
          (c.jobAppliedTo && c.jobAppliedTo.toLowerCase().includes(q)) ||
          (c.resumeText && c.resumeText.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  // positionLookup only used indirectly; filter re-runs when positions or filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, search, sourceFilter, positionFilter, statusFilter, dateFilter, resumeFilter, pipelineFilter, dncFilter, positions]);

  function clearFilters() {
    setSourceFilter("");
    setPositionFilter("");
    setStatusFilter("");
    setDateFilter("");
    setResumeFilter("");
    setPipelineFilter("");
    setDncFilter("");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _positionLookup = positionLookup;

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
      {/* Wide search bar + inline filters toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, phone, skills, experience, position, resume text, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-11 pr-10 py-3 rounded-xl text-sm",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors",
            activeFilterCount > 0 || filtersOpen
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Icon name="tune" size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-accent)] text-white">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Filter row — collapsed by default */}
      {filtersOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className={inputClass}>
            <option value="">All positions</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputClass}>
            <option value="">All sources</option>
            {distinctSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">Any status</option>
            <option value="NEW">New</option>
            <option value="SCREENING">Screening</option>
            <option value="INTERVIEW">Interview</option>
            <option value="OFFER">Offer</option>
            <option value="HIRED">Hired</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputClass}>
            <option value="">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select value={resumeFilter} onChange={(e) => setResumeFilter(e.target.value)} className={inputClass}>
            <option value="">Resume: any</option>
            <option value="with">Has resume</option>
            <option value="without">No resume</option>
          </select>
          <select value={pipelineFilter} onChange={(e) => setPipelineFilter(e.target.value)} className={inputClass}>
            <option value="">Pipeline: any</option>
            <option value="in">In pipeline</option>
            <option value="out">Database only</option>
          </select>
          <select value={dncFilter} onChange={(e) => setDncFilter(e.target.value)} className={inputClass}>
            <option value="">DNC: any</option>
            <option value="yes">Do not call</option>
            <option value="no">Callable</option>
          </select>
        </div>
      )}

      {/* Summary + clear */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {filtered.length} of {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          {activeFilterCount > 0 && <> · {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}</>}
          {search && <> · matching &ldquo;{search}&rdquo;</>}
        </p>
        {(activeFilterCount > 0 || search) && (
          <button
            onClick={() => { setSearch(""); clearFilters(); }}
            className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
          >
            <Icon name="close" size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {filtered.map((c) => {
          const skills = parseSkills(c.skills);
          return (
            <div key={c.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Icon name="description" size={16} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-sm font-medium truncate", c.doNotCall ? "text-red-600" : "text-[var(--color-text-primary)]")}>
                        {c.firstName} {c.lastName}
                      </p>
                      {c.doNotCall && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white shrink-0" title={c.doNotCallReason || undefined}>
                          DO NOT CALL
                        </span>
                      )}
                      {c.applicationCount && c.applicationCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-700 shrink-0">
                          {c.applicationCount}× applied
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{c.email}</p>
                  </div>
                </div>
                {c.source && (
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2",
                    c.source === "pro.jobing"
                      ? "bg-orange-500/10 text-orange-400"
                      : "bg-blue-500/10 text-blue-400"
                  )}>
                    {c.source}
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-3 text-xs">
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Icon name="phone" size={12} className="text-[var(--color-text-muted)]" />
                    <span className="text-[var(--color-text-muted)]">{c.phone}</span>
                  </div>
                )}
                {c.jobAppliedTo && (
                  <div className="flex items-center gap-2">
                    <Icon name="work" size={12} className="text-[var(--color-text-muted)]" />
                    <span className="text-[var(--color-text-muted)] truncate">{c.jobAppliedTo}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">Added: {formatDate(c.createdAt)}</span>
                </div>
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {skills.slice(0, 3).map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      {s}
                    </span>
                  ))}
                  {skills.length > 3 && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">+{skills.length - 3} more</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  {c.resumeUrl && (
                    <a
                      href={`/api/platforms/jobing/resume?url=${encodeURIComponent(c.resumeUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium h-11",
                        "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                      )}
                    >
                      <Icon name="download" size={12} />
                      Resume
                    </a>
                  )}
                </div>
                {c.inPipeline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 h-11">
                    <Icon name="check" size={12} />
                    In Pipeline
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); openPullDialog(c); }}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium h-11",
                      "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                    )}
                  >
                    <Icon name="open_in_new" size={12} />
                    Pull to Recruitment
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
            No candidates found matching your filters
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className={cn("hidden sm:block rounded-xl overflow-x-auto", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <table className="min-w-[900px]" style={{ tableLayout: "fixed", width: Object.values(colWidths).reduce((s, w) => s + w, 0) }}>
          <colgroup>
            <col style={{ width: colWidths.name }} />
            <col style={{ width: colWidths.email }} />
            <col style={{ width: colWidths.phone }} />
            <col style={{ width: colWidths.source }} />
            <col style={{ width: colWidths.job }} />
            <col style={{ width: colWidths.date }} />
            <col style={{ width: colWidths.resume }} />
            <col style={{ width: colWidths.action }} />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <ResizableTh label="Name" colKey="name" startResize={startResize} />
              <ResizableTh label="Email" colKey="email" startResize={startResize} />
              <ResizableTh label="Phone" colKey="phone" startResize={startResize} />
              <ResizableTh label="Source" colKey="source" startResize={startResize} />
              <ResizableTh label="Job Applied" colKey="job" startResize={startResize} />
              <ResizableTh label="Date" colKey="date" startResize={startResize} />
              <ResizableTh label="Resume" colKey="resume" startResize={startResize} />
              <ResizableTh label="Action" colKey="action" startResize={startResize} align="right" />
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
                          <Icon name="expand_less" size={12} className="text-[var(--color-text-muted)] shrink-0" />
                        ) : (
                          <Icon name="expand_more" size={12} className="text-[var(--color-text-muted)] shrink-0" />
                        )}
                        <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Icon name="description" size={12} className="text-blue-400" />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn("text-sm font-medium truncate", c.doNotCall ? "text-red-600" : "text-[var(--color-text-primary)]")}>
                            {c.firstName} {c.lastName}
                          </span>
                          {c.doNotCall && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white shrink-0" title={c.doNotCallReason || undefined}>
                              DNC
                            </span>
                          )}
                          {c.applicationCount && c.applicationCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-700 shrink-0">
                              {c.applicationCount}×
                            </span>
                          )}
                        </div>
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
                            <Icon name="download" size={12} />
                            PDF
                          </a>
                        )}
                        {c.resumeText && (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                            "bg-purple-500/10 text-purple-400"
                          )}>
                            <Icon name="description" size={12} />
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
                          <Icon name="check" size={12} />
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
                          <Icon name="open_in_new" size={12} />
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
                              <Icon name="mail" size={12} className="shrink-0" />
                              <span>{c.email}</span>
                            </div>
                            {c.phone && (
                              <div className="flex items-center gap-2">
                                <Icon name="phone" size={12} className="shrink-0" />
                                <span>{c.phone}</span>
                              </div>
                            )}
                            {c.linkedinUrl && (
                              <div className="flex items-center gap-2">
                                <Icon name="link" size={12} className="shrink-0" />
                                <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline truncate">
                                  LinkedIn Profile
                                </a>
                              </div>
                            )}
                            {c.experience && (
                              <div className="flex items-center gap-2">
                                <Icon name="work" size={12} className="shrink-0" />
                                <span>{c.experience}</span>
                              </div>
                            )}
                            {c.position && (
                              <div className="flex items-center gap-2">
                                <Icon name="work" size={12} className="shrink-0" />
                                <span>Position: {c.position.title}</span>
                              </div>
                            )}
                            {c.jobAppliedTo && (
                              <div className="flex items-center gap-2">
                                <Icon name="work" size={12} className="shrink-0" />
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
                className="px-4 py-3 h-11 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePull}
                disabled={pulling}
                className={cn(
                  "px-4 py-3 h-11 rounded-lg text-sm font-medium",
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
