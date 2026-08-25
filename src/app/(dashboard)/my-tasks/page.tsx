import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { MyOnboardingTasks } from "@/components/onboarding/my-onboarding-tasks";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export default async function MyTasksPage() {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  const viewer = employeeId
    ? await db.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } })
    : null;
  const tasks = employeeId
    ? await db.employeeTask.findMany({
        where: {
          employee: { status: { in: ["PRE_ONBOARDING", "ONBOARDING"] } },
          OR: [
            { assigneeId: employeeId },
            ...(viewer?.departmentId ? [{ assigneeDepartmentId: viewer.departmentId }] : []),
          ],
        },
        include: {
          employee: true,
          checklistItem: { include: { checklist: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="My Tasks"
        description="Complete work assigned directly to you or to your department."
      />
      {tasks.length > 0 ? (
        <MyOnboardingTasks
          title="Assigned to me"
          tasks={tasks.map((task) => ({
            id: task.id,
            title: task.title || task.checklistItem?.title || "Untitled task",
            description: task.description || task.checklistItem?.description || null,
            status: task.status as "PENDING" | "DONE",
            completedAt: task.completedAt?.toISOString() || null,
            dueDay: task.checklistItem?.dueDay || null,
            employeeName: `${task.employee.firstName} ${task.employee.lastName}`,
            employeeId: task.employee.id,
            workflow: task.checklistItem?.checklist.type,
          }))}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-14 text-center">
          <Icon name="task_alt" size={34} className="mx-auto text-[var(--color-text-muted)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No tasks assigned</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">New person and department assignments will appear here.</p>
        </div>
      )}
    </div>
  );
}
