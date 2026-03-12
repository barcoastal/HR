import { cn, formatDate } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserPlus, CheckCircle2, ClipboardList } from "lucide-react";
import { OnboardingTimeline } from "@/components/onboarding/onboarding-timeline";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function OnboardingPage() {
  await requireAuth();

  const onboardingEmployees = await db.employee.findMany({
    where: { status: "ONBOARDING" },
    include: {
      department: true,
      employeeTasks: { include: { checklistItem: { include: { checklist: true } } } },
    },
    orderBy: { startDate: "desc" },
  });

  const allOnboardingChecklistItems = await db.checklistItem.findMany({
    where: { checklist: { type: "ONBOARDING" } },
    include: { checklist: true, assignee: true },
    orderBy: { order: "asc" },
  });

  const recentlyCompleted = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      employeeTasks: { some: { checklistItem: { checklist: { type: "ONBOARDING" } } } },
    },
    include: {
      department: true,
      employeeTasks: {
        include: { checklistItem: { include: { checklist: true } } },
      },
    },
    orderBy: { startDate: "desc" },
    take: 5,
  });

  const completedEmployees = recentlyCompleted.filter((emp) => {
    const tasks = emp.employeeTasks.filter((t) => t.checklistItem.checklist?.type === "ONBOARDING");
    return tasks.length > 0 && tasks.every((t) => t.status === "DONE");
  });

  const pendingTasks = onboardingEmployees.reduce((acc, emp) => acc + emp.employeeTasks.filter((t) => t.status === "PENDING").length, 0);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader title="Onboarding" description="Track and manage new employee onboarding progress" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Active Onboarding" value={onboardingEmployees.length} icon={UserPlus} color="blue" />
        <StatCard title="Completed This Month" value={completedEmployees.length} icon={CheckCircle2} color="emerald" />
        <StatCard title="Pending Tasks" value={pendingTasks} icon={ClipboardList} color="amber" />
      </div>

      <div className="mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Onboarding</h2></div>
      <div className="space-y-3">
        {onboardingEmployees.map((emp) => {
          const assignedItemIds = new Set(emp.employeeTasks.map((t) => t.checklistItemId));
          const availableItems = allOnboardingChecklistItems
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
                title: t.checklistItem.title,
                description: t.checklistItem.description,
                status: t.status as "PENDING" | "DONE",
                completedAt: t.completedAt?.toISOString() || null,
                dueDay: t.checklistItem.dueDay,
              }))}
              availableItems={availableItems}
              type="ONBOARDING"
            />
          );
        })}
        {onboardingEmployees.length === 0 && <p className="text-center text-[var(--color-text-muted)] py-8">No active onboarding</p>}
      </div>

      {completedEmployees.length > 0 && (
        <>
          <div className="mt-8 mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recently Completed</h2></div>
          <div className="space-y-3">
            {completedEmployees.map((emp) => (
              <div key={emp.id} className={cn("rounded-2xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">{emp.firstName[0]}{emp.lastName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{emp.jobTitle} · {emp.department?.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Completed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
