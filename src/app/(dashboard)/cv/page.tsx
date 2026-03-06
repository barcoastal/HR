import { cn } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { getCandidates, getPositions, getAllCandidatesForDatabase } from "@/lib/actions/candidates";
import { getDepartments } from "@/lib/actions/departments";
import { getSyncablePlatforms } from "@/lib/actions/platform-sync";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { Briefcase, Target } from "lucide-react";
import { AddCandidateForm } from "@/components/cv/add-candidate-form";
import { AddPositionForm } from "@/components/cv/add-position-form";
import { CVTabs } from "@/components/cv/cv-tabs";

export default async function CVPage() {
  await requireManagerOrAdmin();
  const [pipelineCandidates, allCandidates, positions, recruitmentPlatforms, syncablePlatforms, departments] = await Promise.all([
    getCandidates({ inPipeline: true }),
    getAllCandidatesForDatabase(),
    getPositions(),
    getRecruitmentPlatforms(),
    getSyncablePlatforms(),
    getDepartments(),
  ]);

  const openPositions = positions.filter((p) => p.status === "OPEN");
  const activeCandidates = pipelineCandidates.filter((c) => !["HIRED", "REJECTED"].includes(c.status)).length;

  return (
    <div className="max-w-full mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Recruitment</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage candidates, positions, and hiring pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <AddPositionForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
          <AddCandidateForm
            positions={positions.map((p) => ({ id: p.id, title: p.title }))}
            platforms={recruitmentPlatforms
              .filter((p) => p.status === "ACTIVE")
              .map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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

      <CVTabs
        pipelineCandidates={pipelineCandidates.map((c) => ({
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
          jobAppliedTo: c.jobAppliedTo,
          inPipeline: c.inPipeline,
          position: c.position ? { title: c.position.title } : null,
          resumeUrl: c.resumeUrl,
          createdAt: c.createdAt,
        }))}
        allCandidates={allCandidates.map((c) => ({
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
          jobAppliedTo: c.jobAppliedTo,
          inPipeline: c.inPipeline,
          position: c.position ? { title: c.position.title } : null,
          resumeUrl: c.resumeUrl,
          createdAt: c.createdAt,
        }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        openPositions={openPositions.map((p) => ({
          id: p.id,
          title: p.title,
          department: p.department ? { name: p.department.name } : null,
          salary: p.salary,
          _count: p._count,
        }))}
        syncablePlatforms={syncablePlatforms}
      />
    </div>
  );
}
