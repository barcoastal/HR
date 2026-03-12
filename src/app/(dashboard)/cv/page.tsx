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
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

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
      <PageHeader
        title="Recruitment"
        description="Manage candidates, positions, and hiring pipeline"
        action={
          <div className="flex items-center gap-2">
            <AddPositionForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
            <AddCandidateForm
              positions={positions.map((p) => ({ id: p.id, title: p.title }))}
              platforms={recruitmentPlatforms
                .filter((p) => p.status === "ACTIVE")
                .map((p) => ({ id: p.id, name: p.name }))}
            />
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Open Positions" value={openPositions.length} icon={<Briefcase className="h-5 w-5" />} color="blue" />
        <StatCard title="Active in Pipeline" value={activeCandidates} icon={<Target className="h-5 w-5" />} color="emerald" />
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
