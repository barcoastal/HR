"use client";

import { cn, getInitials } from "@/lib/utils";
import { updateCandidateStatus, deleteCandidate } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { useMemo, useState } from "react";
import { CandidateDetailDialog } from "./candidate-detail-dialog";
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
  resumeText: string | null;
  resumeUrl: string | null;
  status: CandidateStatus;
  positionId: string | null;
  costOfHire: number | null;
  hourlyRate: number | null;
  managerId: string | null;
  recruiterId: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckId?: string | null;
  backgroundCheckOptions: string | null;
  offerDocUrl: string | null;
  offerSentAt: Date | null;
  offerSignedDocUrl: string | null;
  offerSignedAt: Date | null;
  position: { title: string } | null;
};

type Position = { id: string; title: string };

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

const DEFAULT_COLUMNS: { status: CandidateStatus; label: string; color: string; bg: string }[] = [
  { status: "NEW", label: "New", color: "text-blue-400", bg: "bg-blue-500/10" },
  { status: "SCREENING", label: "Screening", color: "text-amber-400", bg: "bg-amber-500/10" },
  { status: "INTERVIEW", label: "Interview", color: "text-purple-400", bg: "bg-purple-500/10" },
  { status: "OFFER", label: "Offer", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { status: "BACKGROUND_CHECK", label: "BG Check", color: "text-orange-400", bg: "bg-orange-500/10" },
  { status: "PRE_ONBOARDING", label: "Pre-Onboarding", color: "text-teal-400", bg: "bg-teal-500/10" },
  { status: "ONBOARDING", label: "Onboarding", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { status: "HIRED", label: "Hired", color: "text-green-400", bg: "bg-green-500/10" },
  { status: "OFFBOARDING", label: "Offboarding", color: "text-slate-400", bg: "bg-slate-500/10" },
  { status: "REJECTED", label: "Rejected", color: "text-red-400", bg: "bg-red-500/10" },
];

type PipelineStageConfig = { id: string; label: string; color: string; bgColor: string; enumValue: string; visible: boolean; order: number };

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

const INITIAL_COLUMN_LIMIT = 20;

type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };
type Recruiter = { id: string; firstName: string; lastName: string };

export function CandidatePipeline({ candidates, positions, employees, recruiters, pipelineStages }: { candidates: CandidateItem[]; positions: Position[]; employees?: EmployeeOption[]; recruiters?: Recruiter[]; pipelineStages?: PipelineStageConfig[] }) {
  const columns = pipelineStages && pipelineStages.length > 0
    ? pipelineStages.filter(s => s.visible).map(s => ({
        status: s.enumValue as CandidateStatus,
        label: s.label,
        color: s.color,
        bg: s.bgColor.replace("bg-", "bg-") + "/10",
      }))
    : DEFAULT_COLUMNS;
  const router = useRouter();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});

  async function moveCandidate(id: string, newStatus: CandidateStatus) {
    if (newStatus === "HIRED" || newStatus === "BACKGROUND_CHECK") {
      const c = candidates.find((c) => c.id === id);
      if (c) setSelectedCandidate(c);
      return;
    }
    setMovingId(id);
    try {
      await updateCandidateStatus(id, newStatus);
      router.refresh();
    } finally {
      setMovingId(null);
    }
  }

  const filteredCandidates = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      const skills = parseSkills(c.skills).join(" ");
      return (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.experience ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q) ||
        (c.source ?? "").toLowerCase().includes(q) ||
        skills.toLowerCase().includes(q)
      );
    });
  }, [candidates, search]);

  return (
    <>
      <div className="mb-3 relative">
        <Icon
          name="search"
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this position — name, email, phone, skill, source…"
          className="w-full pl-9 pr-9 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            title="Clear search"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = filteredCandidates.filter((c) => c.status === col.status);
          const isExpanded = expandedColumns[col.status] ?? false;
          const visibleItems = isExpanded ? items : items.slice(0, INITIAL_COLUMN_LIMIT);
          const overflow = items.length - visibleItems.length;
          return (
            <div key={col.status} className="min-w-[260px] flex-1">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-3", col.bg)}>
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className={cn("text-xs font-medium ml-auto", col.color)}>{items.length}</span>
              </div>
              <div className="space-y-2">
                {visibleItems.map((candidate) => {
                  const initials = getInitials(candidate.firstName, candidate.lastName);
                  const colorIdx = candidate.firstName.charCodeAt(0) % avatarColors.length;
                  const nextStatus = columns[columns.findIndex((c) => c.status === col.status) + 1]?.status;
                  const hasResume = !!(candidate.resumeUrl || candidate.resumeText);
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={cn(
                        "group rounded-lg p-2.5 cursor-pointer",
                        "bg-[var(--color-surface)] border border-[var(--color-border)]",
                        "hover:border-[var(--color-accent)]/30 hover:shadow-sm transition-all"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0", avatarColors[colorIdx])}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate leading-tight">
                            {candidate.firstName} {candidate.lastName}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate leading-tight">
                            {candidate.email}
                          </p>
                        </div>
                        {hasResume && candidate.resumeUrl && (
                          <a
                            href={
                              candidate.resumeUrl.startsWith("/")
                                ? candidate.resumeUrl
                                : `/api/platforms/jobing/resume?url=${encodeURIComponent(candidate.resumeUrl)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 shrink-0"
                            title="Resume PDF"
                          >
                            <Icon name="description" size={14} />
                          </a>
                        )}
                        {hasResume && !candidate.resumeUrl && (
                          <span className="p-1 text-purple-400 shrink-0" title="Has resume text">
                            <Icon name="description" size={14} />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          {candidate.source && (
                            <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                              via {candidate.source}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Delete ${candidate.firstName} ${candidate.lastName}?`)) return;
                              await deleteCandidate(candidate.id);
                              router.refresh();
                            }}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete candidate"
                          >
                            <Icon name="delete" size={12} />
                          </button>
                          {nextStatus && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveCandidate(candidate.id, nextStatus); }}
                              disabled={movingId === candidate.id}
                              className="text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded px-1.5 py-0.5 disabled:opacity-50"
                              title={`Move to ${columns.find((c) => c.status === nextStatus)?.label}`}
                            >
                              {movingId === candidate.id ? "…" : "→"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-center text-xs text-[var(--color-text-muted)] py-6">
                    {search ? "No matches" : "No candidates"}
                  </p>
                )}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedColumns((p) => ({ ...p, [col.status]: true }))}
                    className="w-full mt-1 py-1.5 rounded-md text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 transition-colors"
                  >
                    Show {overflow} more
                  </button>
                )}
                {isExpanded && items.length > INITIAL_COLUMN_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setExpandedColumns((p) => ({ ...p, [col.status]: false }))}
                    className="w-full mt-1 py-1.5 rounded-md text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-background)] transition-colors"
                  >
                    Show fewer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CandidateDetailDialog
        candidate={selectedCandidate}
        positions={positions}
        employees={employees}
        recruiters={recruiters}
        pipelineStages={pipelineStages}
        open={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </>
  );
}
