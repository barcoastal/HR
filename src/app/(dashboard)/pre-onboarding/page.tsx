import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { OnboardingTimeline } from "@/components/onboarding/onboarding-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";

export default async function PreOnboardingPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user?.role === "SUPER_ADMIN";
  const [assignmentAssignees, assignmentDepartments] = await Promise.all([
    db.employee.findMany({
      where: { archivedAt: null, status: { not: "OFFBOARDED" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const preOnboardingEmployees = await db.employee.findMany({
    where: { status: "PRE_ONBOARDING" },
    include: {
      department: true,
      employeeTasks: {
        include: {
          checklistItem: { include: { checklist: true } },
          signingRequest: true,
          assignee: true,
          assigneeDepartment: true,
          completedBy: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const allPreOnboardingChecklistItems = await db.checklistItem.findMany({
    where: { checklist: { type: "PRE_ONBOARDING", isOverride: false } },
    include: { checklist: true, assignee: true, assigneeDepartment: true },
    orderBy: { order: "asc" },
  });

  const pendingDocuments = preOnboardingEmployees.reduce(
    (acc, emp) => acc + emp.employeeTasks.filter(
      (task) => task.status === "PENDING" && (task.documentAction === "SIGN" || task.documentAction === "FILL")
    ).length,
    0
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader title="Written Offer" description="Track required candidate documents before internal onboarding begins" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="In Written Offer" value={preOnboardingEmployees.length} icon={<Icon name="contract" size={20} />} color="purple" />
        <StatCard title="Documents Remaining" value={pendingDocuments} icon={<Icon name="pending_actions" size={20} />} color="amber" />
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Written Offers</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Candidates move to Onboarding automatically after every required document is complete.</p>
      </div>
      <div className="space-y-3">
        {preOnboardingEmployees.map((emp) => {
          const assignedItemIds = new Set(emp.employeeTasks.map((t) => t.checklistItemId).filter(Boolean));
          const writtenOfferTasks = emp.employeeTasks.filter((task) =>
            task.checklistItem?.checklist?.type === "PRE_ONBOARDING"
          );
          const availableItems = allPreOnboardingChecklistItems
            .filter((item) => !assignedItemIds.has(item.id))
            .map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              checklistName: item.checklist.name,
              assigneeName: item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : null,
              assigneeDepartmentName: item.assigneeDepartment?.name || null,
              dueDay: item.dueDay,
            }));

          return (
            <OnboardingTimeline
              key={emp.id}
              employee={{
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                jobTitle: emp.jobTitle,
                email: emp.email,
              }}
              tasks={writtenOfferTasks.map((t) => ({
                id: t.id,
                title: t.title || t.checklistItem?.title || "Untitled",
                description: t.description || t.checklistItem?.description || null,
                status: t.status as "PENDING" | "DONE",
                completedAt: t.completedAt?.toISOString() || null,
                dueDay: t.checklistItem?.dueDay || null,
                documentAction: t.documentAction || null,
                documentName: t.documentName || null,
                assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
                assigneeDepartmentName: t.assigneeDepartment?.name || null,
                completedByName: t.completedBy ? `${t.completedBy.preferredName || t.completedBy.firstName} ${t.completedBy.lastName}` : null,
                signingStatus: t.signingRequest?.status || null,
              }))}
              availableItems={availableItems}
              type="PRE_ONBOARDING"
              isSuperAdmin={isSuperAdmin}
              assignees={assignmentAssignees}
              departments={assignmentDepartments}
            />
          );
        })}
        {preOnboardingEmployees.length === 0 && (
          <p className="text-center text-[var(--color-text-muted)] py-8">No candidates are waiting on Written Offer documents.</p>
        )}
      </div>
    </div>
  );
}
