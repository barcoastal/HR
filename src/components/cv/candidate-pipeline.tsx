"use client";

import { cn, getInitials } from "@/lib/utils";
import { updateCandidateStatus, updateCandidate, deleteCandidate } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { useMemo, useState } from "react";
import { CandidateDetailDialog } from "./candidate-detail-dialog";
import { Icon } from "@/components/ui/icon";
import { LEGACY_STAGE_ID_BY_STATUS } from "@/lib/pipeline-stage-utils";

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
  applicationCount?: number | null;
  stageId?: string | null;
};

type Position = { id: string; title: string };

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

// Pre-Onboarding, Onboarding, and Offboarding intentionally aren't in the
// recruitment pipeline — they live in their own dedicated sections of the app.
// The enum values still exist on Candidate.status for backward compatibility;
// they just don't render as columns here.
const DEFAULT_COLUMNS: { status: CandidateStatus; label: string; color: string; bg: string }[] = [
  { status: "NEW", label: "New", color: "text-blue-400", bg: "bg-blue-500/10" },
  { status: "CONTACTED", label: "Contacted", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { status: "SCREENING", label: "Screening", color: "text-amber-400", bg: "bg-amber-500/10" },
  { status: "INTERVIEW", label: "Interview", color: "text-purple-400", bg: "bg-purple-500/10" },
  { status: "OFFER", label: "Offer", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { status: "BACKGROUND_CHECK", label: "BG Check", color: "text-orange-400", bg: "bg-orange-500/10" },
  { status: "HIRED", label: "Hired", color: "text-green-400", bg: "bg-green-500/10" },
  { status: "REJECTED", label: "Rejected", color: "text-red-400", bg: "bg-red-500/10" },
];

type PipelineStageConfig = { id: string; label: string; color: string; bgColor: string; enumValue: string; visible: boolean; order: number };

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

const INITIAL_COLUMN_LIMIT = 20;

type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };
type Recruiter = { id: string; firstName: string; lastName: string };

// Stages owned by the onboarding/offboarding sections — never render them
// as recruitment columns even if they're saved on the settings page.
const RECRUITMENT_EXCLUDED: ReadonlySet<string> = new Set([
  "PRE_ONBOARDING",
  "ONBOARDING",
  "OFFBOARDING",
]);


export function CandidatePipeline({ candidates, positions, employees, recruiters, pipelineStages }: { candidates: CandidateItem[]; positions: Position[]; employees?: EmployeeOption[]; recruiters?: Recruiter[]; pipelineStages?: PipelineStageConfig[] }) {
  // Columns are keyed by stage id (not status) — several custom stages can
  // share one base status and still render as separate columns.
  const columns = pipelineStages && pipelineStages.length > 0
    ? [...pipelineStages]
        .filter(s => s.visible && !RECRUITMENT_EXCLUDED.has(s.enumValue))
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          key: s.id,
          stageId: s.id as string | null,
          status: s.enumValue as CandidateStatus,
          label: s.label,
          color: s.color,
          bg: s.bgColor.replace("bg-", "bg-") + "/10",
        }))
    : DEFAULT_COLUMNS.map(c => ({ key: c.status as string, stageId: null as string | null, ...c }));

  // Candidate → column: an explicit stageId wins when that column exists;
  // otherwise the legacy column for the candidate's status (by original stage
  // id, immune to enum remapping in settings); otherwise the first column
  // mapping that status.
  const columnKeyFor = (c: { status: CandidateStatus; stageId?: string | null }): string | null => {
    if (c.stageId && columns.some(col => col.stageId === c.stageId)) return c.stageId;
    const legacyId = LEGACY_STAGE_ID_BY_STATUS[c.status];
    if (legacyId && columns.some(col => col.stageId === legacyId)) return legacyId;
    return columns.find(col => col.status === c.status)?.key ?? null;
  };
  const router = useRouter();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
  const [positionMenuId, setPositionMenuId] = useState<string | null>(null);

  async function changePosition(id: string, positionId: string) {
    setMovingId(id);
    setPositionMenuId(null);
    try {
      await updateCandidate(id, { positionId });
      router.refresh();
    } finally {
      setMovingId(null);
    }
  }

  async function moveCandidate(id: string, newStatus: CandidateStatus, stageId?: string | null) {
    if (newStatus === "HIRED" || newStatus === "BACKGROUND_CHECK") {
      const c = candidates.find((c) => c.id === id);
      if (c) setSelectedCandidate(c);
      return;
    }
    setMovingId(id);
    try {
      await updateCandidateStatus(id, newStatus, stageId);
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
        {columns.map((col, colIdx) => {
          const items = filteredCandidates.filter((c) => columnKeyFor(c) === col.key);
          const isExpanded = expandedColumns[col.key] ?? false;
          const visibleItems = isExpanded ? items : items.slice(0, INITIAL_COLUMN_LIMIT);
          const overflow = items.length - visibleItems.length;
          const nextCol = columns[colIdx + 1];
          return (
            <div key={col.key} className="min-w-[260px] flex-1">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-3", col.bg)}>
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className={cn("text-xs font-medium ml-auto", col.color)}>{items.length}</span>
              </div>
              <div className="space-y-2">
                {visibleItems.map((candidate) => {
                  const initials = getInitials(candidate.firstName, candidate.lastName);
                  const colorIdx = candidate.firstName.charCodeAt(0) % avatarColors.length;
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate leading-tight">
                              {candidate.firstName} {candidate.lastName}
                            </p>
                            {candidate.applicationCount && candidate.applicationCount > 1 && (
                              <span
                                title={`Applied ${candidate.applicationCount} times — open the candidate to see each position`}
                                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                              >
                                ×{candidate.applicationCount}
                              </span>
                            )}
                          </div>
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
                        <div className={cn(
                          "flex items-center gap-1 transition-opacity",
                          positionMenuId === candidate.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                          {positions.filter((p) => p.id !== candidate.positionId).length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPositionMenuId(positionMenuId === candidate.id ? null : candidate.id);
                                }}
                                disabled={movingId === candidate.id}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors disabled:opacity-50"
                                title="Change position"
                              >
                                <Icon name="swap_horiz" size={12} />
                              </button>
                              {positionMenuId === candidate.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 z-20 w-52 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1"
                                >
                                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                                    Move to position
                                  </p>
                                  {positions
                                    .filter((p) => p.id !== candidate.positionId)
                                    .map((p) => (
                                      <button
                                        key={p.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          changePosition(candidate.id, p.id);
                                        }}
                                        className="block w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/10 transition-colors"
                                      >
                                        {p.title}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
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
                          {nextCol && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveCandidate(candidate.id, nextCol.status, nextCol.stageId); }}
                              disabled={movingId === candidate.id}
                              className="text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded px-1.5 py-0.5 disabled:opacity-50"
                              title={`Move to ${nextCol.label}`}
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
                    onClick={() => setExpandedColumns((p) => ({ ...p, [col.key]: true }))}
                    className="w-full mt-1 py-1.5 rounded-md text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 transition-colors"
                  >
                    Show {overflow} more
                  </button>
                )}
                {isExpanded && items.length > INITIAL_COLUMN_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setExpandedColumns((p) => ({ ...p, [col.key]: false }))}
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
