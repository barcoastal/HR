import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { OnboardingTimeline } from "@/components/onboarding/onboarding-timeline";
import { MyOnboardingTasks } from "@/components/onboarding/my-onboarding-tasks";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";
import { OnboardingTabs } from "@/components/onboarding/onboarding-tabs";

export default async function TrainingPage() {
  const session = await requireAdmin();
  const currentEmployeeId = session.user?.employeeId;
  const isSuperAdmin = session.user?.role === "SUPER_ADMIN";
  const [assignmentAssignees, assignmentDepartments, trainingEmployees, availableChecklistItems] = await Promise.all([
    db.employee.findMany({
      where: { archivedAt: null, status: { not: "OFFBOARDED" } },
      select: { id: true, firstName: true, lastName: true, departmentId: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { status: "TRAINING" },
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
    }),
    db.checklistItem.findMany({
      where: { checklist: { type: "TRAINING", isOverride: false } },
      include: { checklist: true, assignee: true, assigneeDepartment: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const trainingTasksFor = (employee: (typeof trainingEmployees)[number]) =>
    employee.employeeTasks.filter((task) => task.checklistItem?.checklist?.type === "TRAINING");
  const pendingTasks = trainingEmployees.reduce(
    (total, employee) => total + trainingTasksFor(employee).filter((task) => task.status === "PENDING").length,
    0
  );
  const readyForOnboarding = trainingEmployees.filter((employee) =>
    trainingTasksFor(employee).every((task) => task.status === "DONE")
  ).length;
  const currentDepartmentId = assignmentAssignees.find((employee) => employee.id === currentEmployeeId)?.departmentId;
  const myAssignedTasks = currentEmployeeId
    ? await db.employeeTask.findMany({
        where: {
          employee: { status: "TRAINING" },
          checklistItem: { checklist: { type: "TRAINING" } },
          OR: [
            { assigneeId: currentEmployeeId },
            ...(currentDepartmentId ? [{ assigneeDepartmentId: currentDepartmentId }] : []),
          ],
        },
        include: { employee: true, checklistItem: { include: { checklist: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title="Onboarding" description="Manage internal onboarding and required training for selected new hires" />
      <OnboardingTabs active="training" />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="In Training" value={trainingEmployees.length} icon={<Icon name="school" size={20} />} color="purple" />
        <StatCard title="Ready for Onboarding" value={readyForOnboarding} icon={<Icon name="task_alt" size={20} />} color="emerald" />
        <StatCard title="Pending Tasks" value={pendingTasks} icon={<Icon name="pending_actions" size={20} />} color="amber" />
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Training</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Complete the assigned work, then move the person to Onboarding.</p>
      </div>
      <div className="space-y-3">
        {trainingEmployees.map((employee) => {
          const assignedItemIds = new Set(employee.employeeTasks.map((task) => task.checklistItemId).filter(Boolean));
          const trainingTasks = trainingTasksFor(employee);
          const availableItems = availableChecklistItems
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
              key={employee.id}
              employee={{
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                jobTitle: employee.jobTitle,
                email: employee.email,
              }}
              tasks={trainingTasks.map((task) => ({
                id: task.id,
                title: task.title || task.checklistItem?.title || "Untitled",
                description: task.description || task.checklistItem?.description || null,
                status: task.status as "PENDING" | "DONE",
                completedAt: task.completedAt?.toISOString() || null,
                dueDay: task.checklistItem?.dueDay || null,
                documentAction: task.documentAction || null,
                documentName: task.documentName || null,
                assigneeName: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : null,
                assigneeDepartmentName: task.assigneeDepartment?.name || null,
                completedByName: task.completedBy ? `${task.completedBy.preferredName || task.completedBy.firstName} ${task.completedBy.lastName}` : null,
                signingStatus: task.signingRequest?.status || null,
              }))}
              availableItems={availableItems}
              type="TRAINING"
              isSuperAdmin={isSuperAdmin}
              assignees={assignmentAssignees.map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))}
              departments={assignmentDepartments}
            />
          );
        })}
        {trainingEmployees.length === 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-12 text-center">
            <Icon name="school" size={34} className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No one is in Training</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Training can be selected for eligible job titles from the Written Offer record.</p>
          </div>
        )}
      </div>

      <MyOnboardingTasks
        title="My Training Tasks"
        tasks={myAssignedTasks.map((task) => ({
          id: task.id,
          title: task.title || task.checklistItem?.title || "Untitled",
          description: task.description || task.checklistItem?.description || null,
          status: task.status as "PENDING" | "DONE",
          completedAt: task.completedAt?.toISOString() || null,
          dueDay: task.checklistItem?.dueDay || null,
          employeeName: `${task.employee.firstName} ${task.employee.lastName}`,
          employeeId: task.employee.id,
          workflow: "TRAINING",
        }))}
      />
    </div>
  );
}
