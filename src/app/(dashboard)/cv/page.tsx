import { cn } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { getCandidates, getPositions, getTotalCandidateCount } from "@/lib/actions/candidates";
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
  const [pipelineCandidates, totalCandidates, positions, recruitmentPlatforms, syncablePlatforms, departments, allEmployees, recruiters, pipelineStages] = await Promise.all([
    getCandidates({ inPipeline: true }),
    getTotalCandidateCount(),
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
  // Active = still in recruitment. Hired/Rejected are terminal, and
  // pre-onboarding/onboarding/offboarding belong to the onboarding section,
  // not recruitment.
  const activeCandidates = pipelineCandidates.filter((c) => !["HIRED", "REJECTED", "PRE_ONBOARDING", "ONBOARDING", "OFFBOARDING"].includes(c.status)).length;

  return (
    <div className="max-w-full mx-auto py-8 px-4">
      <PageHeader
        title="Recruitment"
        description="Manage candidates, positions, and hiring pipeline"
        action={
          <div className="flex items-center gap-2">
            <a
              href="/cv/duplicates"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Find candidates that look like duplicates (phone, name, gmail-dot variants)"
            >
              <Icon name="content_copy" size={16} />
              Duplicates
            </a>
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
        <StatCard title="Total Candidates" value={totalCandidates} icon={<Icon name="group" size={20} />} color="purple" />
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
          backgroundCheckId: c.backgroundCheckId || null,
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
          applicationCount: c.applicationCount,
        }))}
        // Database tab now lazy-fetches its own data when activated
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
