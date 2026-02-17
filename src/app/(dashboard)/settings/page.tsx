import { getInitials } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-helpers";
import { getUsers } from "@/lib/actions/users";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { getJobTitles } from "@/lib/actions/job-titles";
import { getTimeOffPolicies } from "@/lib/actions/time-off";
import { getAllPulseSurveys } from "@/lib/actions/pulse";
import { db } from "@/lib/db";
import { SettingsUserManagement } from "@/components/settings/user-management";
import { CompanyInfo } from "@/components/settings/company-info";
import { DepartmentManager } from "@/components/settings/department-manager";
import { JobTitleManager } from "@/components/settings/job-title-manager";
import { ChecklistManager } from "@/components/settings/checklist-manager";
import { PtoPolicyManager } from "@/components/settings/pto-policy-manager";
import { PulseSurveyManager } from "@/components/settings/pulse-survey-manager";
import { PlatformIntegrationManager } from "@/components/settings/platform-integration-manager";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { hasSyncSupport } from "@/lib/platform-sync";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-teal-500"];

export default async function SettingsPage() {
  await requireAdmin();
  const [users, departments, employees, jobTitles, checklists, policies, pulseSurveys, recruitmentPlatforms] = await Promise.all([
    getUsers(),
    getDepartments(),
    getEmployees(),
    getJobTitles(),
    db.onboardingChecklist.findMany({
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { assignee: true },
        },
      },
    }),
    getTimeOffPolicies(),
    getAllPulseSurveys(),
    getRecruitmentPlatforms(),
  ]);

  const userList = users.map((u) => ({
    id: u.id,
    name: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email,
    email: u.email,
    role: u.role,
    initials: u.employee ? getInitials(u.employee.firstName, u.employee.lastName) : u.email.substring(0, 2).toUpperCase(),
    colorIdx: u.email.charCodeAt(0) % avatarColors.length,
  }));

  const employeeList = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage your company settings, users, and templates</p>
      </div>

      <div className="space-y-8">
        <CompanyInfo />

        <SettingsUserManagement users={userList} />

        <DepartmentManager
          departments={departments.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
          }))}
        />

        <JobTitleManager jobTitles={jobTitles} />

        <ChecklistManager
          employees={employeeList}
          checklists={checklists.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type as "ONBOARDING" | "OFFBOARDING",
            items: c.items.map((i) => ({
              id: i.id,
              title: i.title,
              description: i.description,
              requiresDocument: i.requiresDocument,
              order: i.order,
              assigneeId: i.assigneeId,
              assigneeName: i.assignee ? `${i.assignee.firstName} ${i.assignee.lastName}` : null,
              dueDay: i.dueDay,
            })),
          }))}
        />

        <PtoPolicyManager
          policies={policies.map((p) => ({
            id: p.id,
            name: p.name,
            daysPerYear: p.daysPerYear,
            isUnlimited: p.isUnlimited,
          }))}
        />

        <PulseSurveyManager
          surveys={pulseSurveys.map((s) => ({
            id: s.id,
            question: s.question,
            status: s.status,
            createdAt: s.createdAt,
            _count: s._count,
          }))}
        />

        <PlatformIntegrationManager
          platforms={recruitmentPlatforms.map((p) => ({
            id: p.id,
            name: p.name,
            accountIdentifier: p.accountIdentifier,
            type: p.type,
            monthlyCost: p.monthlyCost,
            status: p.status,
            notes: p.notes,
            apiKey: p.apiKey,
            lastSyncAt: p.lastSyncAt,
            totalSynced: p.totalSynced,
            hasSyncSupport: hasSyncSupport(p.name),
          }))}
        />
      </div>
    </div>
  );
}
