import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getCandidates } from "@/lib/actions/candidates";
import { getPipelineStages } from "@/lib/actions/company-settings";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { MyCandidatesView } from "@/components/cv/my-candidates-view";

export const dynamic = "force-dynamic";

export default async function MyCandidatesPage() {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) redirect("/my-profile");

  const [candidates, pipelineStages] = await Promise.all([
    getCandidates({ recruiterId: employeeId, inPipeline: true }),
    getPipelineStages(),
  ]);

  const counts = {
    active: candidates.filter((c) => !["HIRED", "REJECTED"].includes(c.status)).length,
    hired: candidates.filter((c) => c.status === "HIRED").length,
    rejected: candidates.filter((c) => c.status === "REJECTED").length,
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="My Candidates"
        description="Applicants assigned to you. You're notified when one is added."
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs">
            <Icon name="target" size={14} />
            Active
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{counts.active}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 text-emerald-500 text-xs">
            <Icon name="check_circle" size={14} />
            Hired
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{counts.hired}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <Icon name="cancel" size={14} />
            Rejected
          </div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">{counts.rejected}</p>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="inbox" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-primary)] font-medium">No candidates assigned to you yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">When an HR teammate assigns one, it shows up here and you'll get an email + notification.</p>
        </div>
      ) : (
        <MyCandidatesView
          candidates={candidates.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            phone: c.phone,
            linkedinUrl: c.linkedinUrl,
            status: c.status,
            source: c.source,
            skills: c.skills,
            resumeUrl: c.resumeUrl,
            createdAt: c.createdAt,
            backgroundCheckStatus: c.backgroundCheckStatus || null,
            position: c.position ? { title: c.position.title } : null,
            stageId: c.stageId ?? null,
          }))}
          pipelineStages={pipelineStages}
        />
      )}
    </div>
  );
}
