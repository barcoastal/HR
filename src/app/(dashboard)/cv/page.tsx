import { cn } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { getCandidates, getPositions } from "@/lib/actions/candidates";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { Briefcase, Users, Target } from "lucide-react";
import { CandidatePipeline } from "@/components/cv/candidate-pipeline";
import { AddCandidateForm } from "@/components/cv/add-candidate-form";
import { SearchCandidates } from "@/components/cv/search-candidates";

export default async function CVPage() {
  await requireManagerOrAdmin();
  const [candidates, positions, recruitmentPlatforms] = await Promise.all([getCandidates(), getPositions(), getRecruitmentPlatforms()]);

  const openPositions = positions.filter((p) => p.status === "OPEN");
  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter((c) => !["HIRED", "REJECTED"].includes(c.status)).length;

  return (
    <div className="max-w-full mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Recruitment</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage candidates, positions, and hiring pipeline</p>
        </div>
        <AddCandidateForm
          positions={positions.map((p) => ({ id: p.id, title: p.title }))}
          platforms={recruitmentPlatforms
            .filter((p) => p.status === "ACTIVE")
            .map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{openPositions.length}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Open Positions</p>
            </div>
          </div>
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{totalCandidates}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Total Candidates</p>
            </div>
          </div>
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{activeCandidates}</p>
              <p className="text-sm text-[var(--color-text-muted)]">Active in Pipeline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <SearchCandidates />

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Open Positions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {openPositions.map((pos) => (
              <div key={pos.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{pos.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{pos.department?.name || "No department"}</p>
                {pos.salary && <p className="text-xs text-[var(--color-accent)] mt-1">{pos.salary}</p>}
                <div className="flex items-center gap-1.5 mt-2">
                  <Users className="h-3 w-3 text-[var(--color-text-muted)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">{pos._count.candidates} candidate{pos._count.candidates !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline */}
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Candidate Pipeline</h2>
      <CandidatePipeline
        candidates={candidates.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          linkedinUrl: c.linkedinUrl,
          skills: c.skills,
          experience: c.experience,
          source: c.source,
          notes: c.notes,
          resumeText: c.resumeText,
          status: c.status,
          positionId: c.positionId,
          costOfHire: c.costOfHire,
          position: c.position ? { title: c.position.title } : null,
        }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
      />
    </div>
  );
}
