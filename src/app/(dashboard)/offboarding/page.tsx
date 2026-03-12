import { cn, formatDate } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { UserMinus, CheckCircle2 } from "lucide-react";
import { StartOffboardingDialog } from "@/components/offboarding/start-offboarding-dialog";
import { OnboardingTaskManager } from "@/components/onboarding/onboarding-task-manager";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function OffboardingPage() {
  await requireAuth();

  const activeEmployees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    include: { department: true },
    orderBy: { firstName: "asc" },
  });

  const offboardingEmployees = await db.employee.findMany({
    where: { status: "OFFBOARDED", endDate: { gte: new Date() } },
    include: {
      department: true,
      employeeTasks: { include: { checklistItem: { include: { checklist: true } } } },
    },
    orderBy: { endDate: "asc" },
  });

  const allOffboardingChecklistItems = await db.checklistItem.findMany({
    where: { checklist: { type: "OFFBOARDING" } },
    include: { checklist: true, assignee: true },
    orderBy: { order: "asc" },
  });

  const completedOffboarding = await db.employee.findMany({
    where: { status: "OFFBOARDED", endDate: { lt: new Date() } },
    include: { department: true },
    orderBy: { endDate: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader
        title="Offboarding"
        description="Manage departing employee transitions and task checklists"
        action={
          <StartOffboardingDialog
            employees={activeEmployees.map((e) => ({
              id: e.id,
              firstName: e.firstName,
              lastName: e.lastName,
              jobTitle: e.jobTitle,
              department: e.department ? { name: e.department.name } : null,
            }))}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="Active Offboarding" value={offboardingEmployees.length} icon={UserMinus} color="amber" />
        <StatCard title="Completed This Month" value={completedOffboarding.length} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Offboarding</h2></div>
      <div className="space-y-3">
        {offboardingEmployees.map((emp) => {
          const offTasks = emp.employeeTasks.filter((t) => t.checklistItem.checklist?.type === "OFFBOARDING");
          const assignedItemIds = new Set(offTasks.map((t) => t.checklistItemId));
          const availableItems = allOffboardingChecklistItems
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
            <OnboardingTaskManager
              key={emp.id}
              employee={{
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                jobTitle: emp.jobTitle,
              }}
              tasks={offTasks.map((t) => ({
                id: t.id,
                title: t.checklistItem.title,
                description: t.checklistItem.description,
                status: t.status as "PENDING" | "DONE",
                completedAt: t.completedAt?.toISOString() || null,
              }))}
              availableItems={availableItems}
              type="OFFBOARDING"
            />
          );
        })}
        {offboardingEmployees.length === 0 && <p className="text-center text-[var(--color-text-muted)] py-8">No active offboarding</p>}
      </div>

      {completedOffboarding.length > 0 && (
        <>
          <div className="mt-8 mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recently Completed</h2></div>
          <div className="space-y-3">
            {completedOffboarding.map((emp) => (
              <div key={emp.id} className={cn("rounded-2xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">{emp.firstName[0]}{emp.lastName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{emp.jobTitle} · {emp.department?.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Completed</span>
                    {emp.endDate && <span className="text-[var(--color-text-muted)] ml-1">{formatDate(emp.endDate)}</span>}
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
