"use client";

import { cn, getInitials } from "@/lib/utils";
import { updateCandidateStatus, hireCandidateAndStartOnboarding, deleteCandidate } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { useState } from "react";
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
  backgroundCheckOptions: string | null;
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
  const [hiringId, setHiringId] = useState<string | null>(null);

  async function moveCandidate(id: string, newStatus: CandidateStatus) {
    if (newStatus === "HIRED" || newStatus === "BACKGROUND_CHECK") {
      // Open detail dialog so user can provide company email / configure options
      const c = candidates.find((c) => c.id === id);
      if (c) setSelectedCandidate(c);
      return;
    }
    await updateCandidateStatus(id, newStatus);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const items = candidates.filter((c) => c.status === col.status);
          return (
            <div key={col.status} className="min-w-[260px] flex-1">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-3", col.bg)}>
                <span className={cn("text-sm font-semibold", col.color)}>{col.label}</span>
                <span className={cn("text-xs font-medium ml-auto", col.color)}>{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((candidate) => {
                  const initials = getInitials(candidate.firstName, candidate.lastName);
                  const colorIdx = candidate.firstName.charCodeAt(0) % avatarColors.length;
                  const nextStatus = columns[columns.findIndex((c) => c.status === col.status) + 1]?.status;
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={cn(
                        "rounded-lg p-3 cursor-pointer",
                        "bg-[var(--color-surface)] border border-[var(--color-border)]",
                        "hover:border-[var(--color-accent)]/30 transition-all"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {candidate.firstName} {candidate.lastName}
                          </p>
                          {candidate.position && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{candidate.position.title}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {parseSkills(candidate.skills).slice(0, 3).map((skill) => (
                          <span key={skill} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                            {skill}
                          </span>
                        ))}
                        {parseSkills(candidate.skills).length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-muted)]">
                            +{parseSkills(candidate.skills).length - 3}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 mb-2 text-[10px] text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon name="mail" size={12} className="shrink-0" />
                          <span className="truncate">{candidate.email}</span>
                        </div>
                        {candidate.phone && (
                          <div className="flex items-center gap-1.5">
                            <Icon name="phone" size={12} className="shrink-0" />
                            <span>{candidate.phone}</span>
                          </div>
                        )}
                        {candidate.experience && (
                          <div className="flex items-center gap-1.5">
                            <Icon name="work" size={12} className="shrink-0" />
                            <span>{candidate.experience}</span>
                          </div>
                        )}
                        {candidate.linkedinUrl && (
                          <div className="flex items-center gap-1.5">
                            <Icon name="link" size={12} className="shrink-0" />
                            <a
                              href={candidate.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[var(--color-accent)] hover:underline truncate"
                            >
                              LinkedIn
                            </a>
                          </div>
                        )}
                      </div>
                      {(candidate.resumeUrl || candidate.resumeText) && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {candidate.resumeUrl && (
                            <a
                              href={`/api/platforms/jobing/resume?url=${encodeURIComponent(candidate.resumeUrl)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                              )}
                            >
                              <Icon name="download" />
                              Resume PDF
                            </a>
                          )}
                          {candidate.resumeText && !candidate.resumeUrl && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400">
                              <Icon name="description" />
                              Resume
                            </span>
                          )}
                        </div>
                      )}
                      {candidate.notes && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mb-2 line-clamp-2 italic">
                          {candidate.notes}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {candidate.source && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              via {candidate.source}
                            </span>
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
                        </div>
                        {nextStatus && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveCandidate(candidate.id, nextStatus); }}
                            disabled={hiringId === candidate.id}
                            className="text-[10px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50 py-2 px-1 min-h-[44px]"
                          >
                            {hiringId === candidate.id ? "Hiring..." : `Move to ${columns.find((c) => c.status === nextStatus)?.label} →`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-center text-xs text-[var(--color-text-muted)] py-6">No candidates</p>
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
        open={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </>
  );
}
