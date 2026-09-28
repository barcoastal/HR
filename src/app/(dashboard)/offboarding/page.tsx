import { displayName, getInitials, displayFirstName } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { StartOffboardingDialog } from "@/components/offboarding/start-offboarding-dialog";
import { OnboardingTaskManager } from "@/components/onboarding/onboarding-task-manager";
import { FormerEmployeesList } from "@/components/offboarding/former-employees-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";

export default async function OffboardingPage() {
  const session = await requireAdmin();
  const isSuperAdmin = session.user?.role === "SUPER_ADMIN";

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

  // Everyone who has already left. Archived (deleted) records live in the Employee Archive.
  const formerEmployees = await db.employee.findMany({
    where: {
      status: "OFFBOARDED",
      archivedAt: null,
      OR: [{ endDate: { lt: new Date() } }, { endDate: null }],
    },
    include: { department: true, _count: { select: { documents: true } } },
    orderBy: { endDate: { sort: "desc", nulls: "last" } },
  });
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const completedThisMonth = formerEmployees.filter((emp) => emp.endDate && emp.endDate >= startOfMonth).length;

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
        <StatCard title="Active Offboarding" value={offboardingEmployees.length} icon={<Icon name="person_remove" size={20} />} color="amber" />
        <StatCard title="Completed This Month" value={completedThisMonth} icon={<Icon name="check_circle" size={20} />} color="emerald" />
      </div>

      <div className="mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Active Offboarding</h2></div>
      <div className="space-y-3">
        {offboardingEmployees.map((emp) => {
          const offTasks = emp.employeeTasks.filter((t) => t.checklistItem?.checklist?.type === "OFFBOARDING");
          const assignedItemIds = new Set(offTasks.map((t) => t.checklistItemId).filter(Boolean));
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
                title: t.title || t.checklistItem?.title || "Untitled",
                description: t.description || t.checklistItem?.description || null,
                status: t.status as "PENDING" | "DONE",
                completedAt: t.completedAt?.toISOString() || null,
              }))}
              availableItems={availableItems}
              type="OFFBOARDING"
              isSuperAdmin={isSuperAdmin}
            />
          );
        })}
        {offboardingEmployees.length === 0 && <p className="text-center text-[var(--color-text-muted)] py-8">No active offboarding</p>}
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Former employees</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">See who can be rehired. Open a person to view their documents and history.</p>
      </div>
      {formerEmployees.length === 0 ? (
        <p className="text-center text-[var(--color-text-muted)] py-8">No former employees yet</p>
      ) : (
        <FormerEmployeesList
          people={formerEmployees.map((emp) => ({
            id: emp.id,
            name: displayName(emp),
            initials: getInitials(displayFirstName(emp), emp.lastName),
            jobTitle: emp.jobTitle,
            departmentName: emp.department?.name || null,
            endDate: emp.endDate?.toISOString() || null,
            rehireEligible: emp.rehireEligible,
            rehireNotes: emp.rehireNotes,
            documentCount: emp._count.documents,
          }))}
        />
      )}
    </div>
  );
}
