import { Suspense } from "react";
import Link from "next/link";
import { getInitials } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-helpers";
import { getUsers } from "@/lib/actions/users";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { getJobTitles } from "@/lib/actions/job-titles";
import { getTimeOffPolicies } from "@/lib/actions/time-off";
import { getAllPulseSurveys } from "@/lib/actions/pulse";
import { SettingsUserManagement } from "@/components/settings/user-management";
import { CompanyInfo } from "@/components/settings/company-info";
import { DepartmentManager } from "@/components/settings/department-manager";
import { JobTitleManager } from "@/components/settings/job-title-manager";
import { OffboardingSetup } from "@/components/settings/offboarding-setup";
import { OnboardingSetup } from "@/components/settings/onboarding-setup";
import { TrainingEligibilitySettings } from "@/components/settings/training-eligibility-settings";
import { PtoPolicyManager } from "@/components/settings/pto-policy-manager";
import { PulseSurveyManager } from "@/components/settings/pulse-survey-manager";
import { PlatformIntegrationManager } from "@/components/settings/platform-integration-manager";
import { NativeIntegrations } from "@/components/settings/native-integrations";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { getCompanySettings } from "@/lib/actions/company-settings";
import { getEmailTemplates } from "@/lib/actions/email-templates";
import { EmailTemplateManager } from "@/components/settings/email-template-manager";
import { EmailDeliveryActivity } from "@/components/settings/email-delivery-activity";
import { getRecentEmailDeliveries } from "@/lib/actions/email-deliveries";
import { getRolePermissions } from "@/lib/actions/role-permissions";
import { PermissionsManager } from "@/components/settings/permissions-manager";
import { hasSyncSupport, SUPPORTED_PLATFORMS } from "@/lib/platform-sync";
import { PageHeader } from "@/components/ui/page-header";
import { CleanupDemoButton } from "@/components/settings/cleanup-demo-button";
import { RecruiterManager } from "@/components/settings/recruiter-manager";
import { PipelineSettings } from "@/components/settings/pipeline-settings";
import { getRecruiters, getPipelineStages, getCandidateCustomFields, getStageNotifyRecipients, getStageNotifyEmployeeIds } from "@/lib/actions/company-settings";
import { getAllStageDocuments, getEligibleCountersigners } from "@/lib/actions/stage-documents";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { getNotificationRules, getNotificationRecipients } from "@/lib/actions/notification-settings";
import { seedNotificationRules } from "@/lib/notifications/seed";
import { StageDocumentsManager } from "@/components/settings/stage-documents-manager";
import { PositionDocumentsManager } from "@/components/settings/position-documents-manager";
import { getAllPositionDocuments } from "@/lib/actions/position-documents";
import { getPositions } from "@/lib/actions/candidates";
import { GustoConnection } from "@/components/settings/gusto-connection";
import { getGustoConnection, getEmployeeMapping } from "@/lib/actions/gusto";
import { DepartmentReviewTemplates } from "@/components/settings/department-review-templates";
import { getDepartmentReviewTemplates } from "@/lib/actions/reviews";
import { db } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/client";
import { isTrainingEligibleJobTitle, parseTrainingEligibleJobTitles } from "@/lib/training-eligibility";
import {
  SETTINGS_SECTIONS,
  SETTINGS_PANELS,
  SettingsNavigation,
  SettingsSectionHeader,
  SettingsSubnavigation,
  type SettingsSectionId,
} from "@/components/settings/settings-navigation";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-teal-500"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; panel?: string; oauth_success?: string; oauth_error?: string }>;
}) {
  const params = await searchParams;
  const requestedSection = params.oauth_success || params.oauth_error
    ? "integrations"
    : params.section;
  const activeSection: SettingsSectionId = SETTINGS_SECTIONS.some((section) => section.id === requestedSection)
    ? requestedSection as SettingsSectionId
    : "company";
  const panels = SETTINGS_PANELS[activeSection] || [];
  const activePanel = panels.some((panel) => panel.id === params.panel)
    ? params.panel!
    : panels[0]?.id || "";
  const session = await requireAdmin();
  await seedNotificationRules();
  const [users, departments, employees, jobTitles, policies, pulseSurveys, recruitmentPlatforms, companySettings, emailTemplates, rolePermissions, recruiters, gustoConnection, pipelineStages, candidateFields, stageNotifyRecipients, stageNotifyEmployeeIds, stageDocuments, deptReviewTemplates, notificationRules, notificationRecipients, countersigners, positionDocuments, positions] = await Promise.all([
    getUsers(),
    getDepartments(),
    getEmployees(),
    getJobTitles(),
    getTimeOffPolicies(),
    getAllPulseSurveys(),
    getRecruitmentPlatforms(),
    getCompanySettings(),
    getEmailTemplates(),
    getRolePermissions(),
    getRecruiters(),
    getGustoConnection(),
    getPipelineStages(),
    getCandidateCustomFields(),
    getStageNotifyRecipients(),
    getStageNotifyEmployeeIds(),
    getAllStageDocuments(),
    getDepartmentReviewTemplates(),
    getNotificationRules(),
    getNotificationRecipients(),
    getEligibleCountersigners(),
    getAllPositionDocuments(),
    getPositions(),
  ]);

  const activeEmployeeCount = await db.employee.count({ where: { status: "ACTIVE" } });
  const emailDeliveries = activeSection === "email" && activePanel === "delivery" ? await getRecentEmailDeliveries() : [];

  let gustoMapping = null;
  if (gustoConnection && activeSection === "integrations" && activePanel === "payroll") {
    try {
      gustoMapping = await getEmployeeMapping();
    } catch {
      // Gusto API may be unavailable
    }
  }

  const userList = users.map((u) => ({
    id: u.id,
    name: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email,
    email: u.email,
    role: u.role,
    initials: u.employee ? getInitials(u.employee.firstName, u.employee.lastName) : u.email.substring(0, 2).toUpperCase(),
    colorIdx: u.email.charCodeAt(0) % avatarColors.length,
  }));

  const employeeList = employees.filter((e) => e.status !== "OFFBOARDED").map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
  }));
  const configuredTrainingEligibleJobTitles = parseTrainingEligibleJobTitles(companySettings.trainingEligibleJobTitles);
  const selectedTrainingJobTitles = jobTitles
    .filter((jobTitle) => isTrainingEligibleJobTitle(jobTitle.name, configuredTrainingEligibleJobTitles))
    .map((jobTitle) => jobTitle.name);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <PageHeader title="Settings" description="Manage company configuration by area" />
      <SettingsNavigation active={activeSection} mobile />

      <div className="grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsNavigation active={activeSection} />
        <main className="min-w-0 max-w-4xl">
          <SettingsSectionHeader
            active={activeSection}
            action={activeSection === "email" ? (
              <Link href="/email-log" className="inline-flex h-10 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]">
                Open Email Log
              </Link>
            ) : undefined}
          />
          <SettingsSubnavigation section={activeSection} activePanel={activePanel} />

          <div className="space-y-6">
            {activeSection === "company" && (
              <>
                <CompanyInfo
                  settings={{
                    companyName: companySettings.companyName,
                    domain: companySettings.domain,
                    industry: companySettings.industry,
                    logoUrl: companySettings.logoUrl,
                    faviconUrl: companySettings.faviconUrl,
                    senderEmail: companySettings.senderEmail,
                    senderName: companySettings.senderName,
                  }}
                  activeEmployeeCount={activeEmployeeCount}
                />
                <CleanupDemoButton />
              </>
            )}

            {activeSection === "access" && (
              <>
                {activePanel === "users" && <SettingsUserManagement users={userList} currentUserRole={(session.user?.role || "EMPLOYEE") as UserRole} />}
                {activePanel === "permissions" && <PermissionsManager permissions={rolePermissions} />}
              </>
            )}

            {activeSection === "organization" && (
              <>
                {activePanel === "departments" && <DepartmentManager departments={departments.map((d) => ({ id: d.id, name: d.name, description: d.description }))} />}
                {activePanel === "job-titles" && <JobTitleManager jobTitles={jobTitles} />}
              </>
            )}

            {activeSection === "recruitment" && (
              <>
                {activePanel === "recruiters" && <RecruiterManager
                  recruiters={recruiters.map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email, jobTitle: r.jobTitle }))}
                  allEmployees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, jobTitle: e.jobTitle }))}
                />}
                {activePanel === "pipeline" && <PipelineSettings initialStages={pipelineStages} initialCustomFields={candidateFields} />}
                {activePanel === "notifications" && <NotificationSettings
                  initialRules={notificationRules}
                  initialRecipients={notificationRecipients}
                  allEmployees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email }))}
                />}
              </>
            )}

            {activeSection === "documents" && (
              <>
                {activePanel === "stage-documents" && <StageDocumentsManager
                  documents={stageDocuments.map((d) => ({
                    id: d.id, stage: d.stage, name: d.name, placeholders: d.placeholders,
                    requiresSignature: d.requiresSignature, requiresFill: d.requiresFill,
                    requiresCountersignature: d.requiresCountersignature, countersignerId: d.countersignerId,
                    order: d.order, hasPdf: d.hasPdf,
                  }))}
                  countersigners={countersigners}
                />}
                {activePanel === "position-documents" && <PositionDocumentsManager
                  documents={positionDocuments.map((d) => ({
                    id: d.id, positionId: d.positionId, name: d.name, placeholders: d.placeholders,
                    requiresSignature: d.requiresSignature, requiresFill: d.requiresFill,
                    requiresCountersignature: d.requiresCountersignature, countersignerId: d.countersignerId,
                    order: d.order, hasPdf: d.hasPdf,
                  }))}
                  positions={positions.map((p) => ({ id: p.id, title: p.title, departmentName: p.department?.name ?? null }))}
                  countersigners={countersigners}
                />}
              </>
            )}

            {activeSection === "workflows" && (
              <>
                {activePanel === "written-offer" && <OnboardingSetup
                  departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  employees={employeeList}
                  jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
                  checklistType="PRE_ONBOARDING"
                />}
                {activePanel === "training" && (
                  <>
                    <TrainingEligibilitySettings
                      jobTitles={jobTitles.map((jobTitle) => ({ id: jobTitle.id, name: jobTitle.name }))}
                      initialTitles={selectedTrainingJobTitles}
                    />
                    <OnboardingSetup
                      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                      employees={employeeList}
                      jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
                      checklistType="TRAINING"
                    />
                  </>
                )}
                {activePanel === "onboarding" && <OnboardingSetup
                  departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  employees={employeeList}
                  jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
                />}
                {activePanel === "offboarding" && <OffboardingSetup
                  departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  employees={employeeList}
                  jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
                />}
              </>
            )}

            {activeSection === "email" && (
              <>
                {activePanel === "templates" && <EmailTemplateManager templates={emailTemplates} userEmail={session.user.email || ""} />}
                {activePanel === "delivery" && <EmailDeliveryActivity deliveries={emailDeliveries} />}
              </>
            )}

            {activeSection === "integrations" && (
              <>
                {activePanel === "connected-apps" && <Suspense>
                  <NativeIntegrations
                    connected={recruitmentPlatforms
                      .filter((p) => SUPPORTED_PLATFORMS.some((sp) => sp.name === p.name))
                      .map((p) => ({ name: p.name, apiKey: p.apiKey, lastSyncAt: p.lastSyncAt, totalSynced: p.totalSynced }))}
                  />
                </Suspense>}
                {activePanel === "platform-accounts" && <PlatformIntegrationManager
                  platforms={recruitmentPlatforms.map((p) => ({
                    id: p.id, name: p.name, accountIdentifier: p.accountIdentifier, type: p.type,
                    monthlyCost: p.monthlyCost, status: p.status, notes: p.notes, apiKey: p.apiKey,
                    lastSyncAt: p.lastSyncAt, totalSynced: p.totalSynced, hasSyncSupport: hasSyncSupport(p.name),
                  }))}
                />}
                {activePanel === "payroll" && <GustoConnection
                  connection={gustoConnection ? { companyName: gustoConnection.companyName, createdAt: gustoConnection.createdAt, tokenExpiresAt: gustoConnection.tokenExpiresAt } : null}
                  mapping={gustoMapping}
                />}
              </>
            )}

            {activeSection === "policies" && (
              <>
                {activePanel === "pto" && <PtoPolicyManager policies={policies.map((p) => ({ id: p.id, name: p.name, daysPerYear: p.daysPerYear, isUnlimited: p.isUnlimited, documentUrl: p.documentUrl, documentName: p.documentName }))} />}
                {activePanel === "reviews" && <DepartmentReviewTemplates
                  departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                  templates={deptReviewTemplates.map((t) => ({
                    departmentId: t.departmentId, departmentName: t.department.name, name: t.name,
                    selfTemplate: t.selfTemplate, managerTemplate: t.managerTemplate,
                  }))}
                />}
                {activePanel === "pulse" && <PulseSurveyManager surveys={pulseSurveys.map((s) => ({ id: s.id, question: s.question, status: s.status, createdAt: s.createdAt, _count: s._count }))} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
