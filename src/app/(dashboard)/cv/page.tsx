import { cn } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { getCandidates, getPositions, getAllCandidatesForDatabase } from "@/lib/actions/candidates";
import { getDepartments } from "@/lib/actions/departments";
import { getEmployees } from "@/lib/actions/employees";
import { getSyncablePlatforms } from "@/lib/actions/platform-sync";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { getRecruiters, getPipelineStages } from "@/lib/actions/company-settings";
import { AddCandidateForm } from "@/components/cv/add-candidate-form";
import { AddPositionForm } from "@/components/cv/add-position-form";
import { CVTabs } from "@/components/cv/cv-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";

export default async function CVPage() {
  await requireManagerOrAdmin();
  const [pipelineCandidates, allCandidates, positions, recruitmentPlatforms, syncablePlatforms, departments, allEmployees, recruiters, pipelineStages] = await Promise.all([
    getCandidates({ inPipeline: true }),
    getAllCandidatesForDatabase(),
    getPositions(),
    getRecruitmentPlatforms(),
    getSyncablePlatforms(),
    getDepartments(),
    getEmployees(),
    getRecruiters(),
    getPipelineStages(),
  ]);

  const openPositions = positions.filter((p) => p.status === "OPEN");
  const closedPositions = positions.filter((p) => p.status === "FILLED" || p.status === "CLOSED");
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Open Positions" value={openPositions.length} icon={<Icon name="work" size={20} />} color="blue" />
        <StatCard title="Active in Pipeline" value={activeCandidates} icon={<Icon name="target" size={20} />} color="emerald" />
        <StatCard title="Total Candidates" value={allCandidates.length} icon={<Icon name="group" size={20} />} color="purple" />
        <StatCard title="Archived Positions" value={closedPositions.length} icon={<Icon name="archive" size={20} />} color="amber" />
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
          resumeText: null,
          status: c.status,
          positionId: c.positionId,
          costOfHire: c.costOfHire,
          hourlyRate: c.hourlyRate,
          managerId: c.managerId || null,
          recruiterId: c.recruiterId || null,
          backgroundCheckStatus: c.backgroundCheckStatus || null,
          backgroundCheckOptions: c.backgroundCheckOptions || null,
          adverseActionLetterSentAt: c.adverseActionLetterSentAt || null,
          offerDocUrl: c.offerDocUrl || null,
          offerSentAt: c.offerSentAt || null,
          offerSignedDocUrl: c.offerSignedDocUrl || null,
          offerSignedAt: c.offerSignedAt || null,
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
          resumeText: null,
          status: c.status,
          positionId: c.positionId,
          costOfHire: c.costOfHire,
          hourlyRate: c.hourlyRate,
          managerId: c.managerId || null,
          recruiterId: c.recruiterId || null,
          backgroundCheckStatus: c.backgroundCheckStatus || null,
          backgroundCheckOptions: c.backgroundCheckOptions || null,
          adverseActionLetterSentAt: c.adverseActionLetterSentAt || null,
          offerDocUrl: c.offerDocUrl || null,
          offerSentAt: c.offerSentAt || null,
          offerSignedDocUrl: c.offerSignedDocUrl || null,
          offerSignedAt: c.offerSignedAt || null,
          jobAppliedTo: c.jobAppliedTo,
          inPipeline: c.inPipeline,
          position: c.position ? { title: c.position.title } : null,
          resumeUrl: c.resumeUrl,
          createdAt: c.createdAt,
          doNotCall: c.doNotCall,
          doNotCallReason: c.doNotCallReason,
          applicationCount: c.applicationCount,
        }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        openPositions={openPositions.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          description: p.description,
          requirements: p.requirements,
          location: p.location,
          type: p.type,
          departmentId: p.departmentId,
          department: p.department ? { name: p.department.name } : null,
          salary: p.salary,
          _count: p._count,
        }))}
        closedPositions={closedPositions.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          description: p.description,
          requirements: p.requirements,
          location: p.location,
          type: p.type,
          departmentId: p.departmentId,
          department: p.department ? { name: p.department.name } : null,
          salary: p.salary,
          _count: p._count,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        syncablePlatforms={syncablePlatforms}
        employees={allEmployees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle }))}
        recruiters={recruiters.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }))}
        pipelineStages={pipelineStages}
      />
    </div>
  );
}
