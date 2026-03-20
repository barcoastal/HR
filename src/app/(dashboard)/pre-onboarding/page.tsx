import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserPlus, CheckCircle2, ClipboardList } from "lucide-react";
import { OnboardingTimeline } from "@/components/onboarding/onboarding-timeline";
import { MyOnboardingTasks } from "@/components/onboarding/my-onboarding-tasks";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function PreOnboardingPage() {
  const session = await requireAdmin();
  const currentEmployeeId = session.user?.employeeId;
  const isSuperAdmin = session.user?.role === "SUPER_ADMIN";

  const preOnboardingEmployees = await db.employee.findMany({
    where: { status: "PRE_ONBOARDING" },
    include: {
      department: true,
      employeeTasks: {
        include: {
          checklistItem: { include: { checklist: true } },
          signingRequest: true,
          assignee: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  const allPreOnboardingChecklistItems = await db.checklistItem.findMany({
    where: { checklist: { type: "PRE_ONBOARDING" } },
    include: { checklist: true, assignee: true },
    orderBy: { order: "asc" },
  });

  const pendingTasks = preOnboardingEmployees.reduce(
    (acc, emp) => acc + emp.employeeTasks.filter((t) => t.status === "PENDING").length,
    0
  );

  const myAssignedTasks = currentEmployeeId
    ? await db.employeeTask.findMany({
        where: {
          assigneeId: currentEmployeeId,
          employee: { status: "PRE_ONBOARDING" },
        },
        include: {
          employee: true,
          checklistItem: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader title="Pre-Onboarding" description="Track and manage pre-onboarding tasks before full onboarding begins" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="In Pre-Onboarding" value={preOnboardingEmployees.length} icon={<ClipboardList className="h-5 w-5" />} color="purple" />
        <StatCard title="Pending Tasks" value={pendingTasks} icon={<UserPlus className="h-5 w-5" />} color="amber" />
      </div>

      <div className="mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Pre-Onboarding</h2></div>
      <div className="space-y-3">
        {preOnboardingEmployees.map((emp) => {
          const assignedItemIds = new Set(emp.employeeTasks.map((t) => t.checklistItemId).filter(Boolean));
          const availableItems = allPreOnboardingChecklistItems
            .filter((item) => !assignedItemIds.has(item.id))
            .map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              checklistName: item.checklist.name,
              assigneeName: item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : null,
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
              }}
              tasks={emp.employeeTasks.map((t) => ({
                id: t.id,
                title: t.title || t.checklistItem?.title || "Untitled",
                description: t.description || t.checklistItem?.description || null,
                status: t.status as "PENDING" | "DONE",
                completedAt: t.completedAt?.toISOString() || null,
                dueDay: t.checklistItem?.dueDay || null,
                documentAction: t.documentAction || null,
                documentName: t.documentName || null,
                assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
                signingStatus: t.signingRequest?.status || null,
              }))}
              availableItems={availableItems}
              type="PRE_ONBOARDING"
              isSuperAdmin={isSuperAdmin}
            />
          );
        })}
        {preOnboardingEmployees.length === 0 && (
          <p className="text-center text-[var(--color-text-muted)] py-8">No active pre-onboarding</p>
        )}
      </div>

      <MyOnboardingTasks
        tasks={myAssignedTasks.map((t) => ({
          id: t.id,
          title: t.title || t.checklistItem?.title || "Untitled",
          description: t.description || t.checklistItem?.description || null,
          status: t.status as "PENDING" | "DONE",
          completedAt: t.completedAt?.toISOString() || null,
          dueDay: t.checklistItem?.dueDay || null,
          employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
          employeeId: t.employee.id,
        }))}
      />
    </div>
  );
}
