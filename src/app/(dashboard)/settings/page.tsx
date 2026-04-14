import { Suspense } from "react";
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
import { PtoPolicyManager } from "@/components/settings/pto-policy-manager";
import { PulseSurveyManager } from "@/components/settings/pulse-survey-manager";
import { PlatformIntegrationManager } from "@/components/settings/platform-integration-manager";
import { NativeIntegrations } from "@/components/settings/native-integrations";
import { getRecruitmentPlatforms } from "@/lib/actions/recruitment-platforms";
import { getCompanySettings } from "@/lib/actions/company-settings";
import { getEmailTemplates } from "@/lib/actions/email-templates";
import { EmailTemplateManager } from "@/components/settings/email-template-manager";
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
import { GustoConnection } from "@/components/settings/gusto-connection";
import { getGustoConnection, getEmployeeMapping } from "@/lib/actions/gusto";
import { DepartmentReviewTemplates } from "@/components/settings/department-review-templates";
import { getDepartmentReviewTemplates } from "@/lib/actions/reviews";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-teal-500"];

export default async function SettingsPage() {
  const session = await requireAdmin();
  await seedNotificationRules();
  const [users, departments, employees, jobTitles, policies, pulseSurveys, recruitmentPlatforms, companySettings, emailTemplates, rolePermissions, recruiters, gustoConnection, pipelineStages, candidateFields, stageNotifyRecipients, stageNotifyEmployeeIds, stageDocuments, deptReviewTemplates, notificationRules, notificationRecipients, countersigners] = await Promise.all([
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
  ]);

  let gustoMapping = null;
  if (gustoConnection) {
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

  const employeeList = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader title="Settings" description="Manage your company settings, users, and templates" />

      <div className="space-y-8">
        <CompanyInfo settings={{
          companyName: companySettings.companyName,
          domain: companySettings.domain,
          industry: companySettings.industry,
          companySize: companySettings.companySize,
          logoUrl: companySettings.logoUrl,
          faviconUrl: companySettings.faviconUrl,
          senderEmail: companySettings.senderEmail,
          senderName: companySettings.senderName,
        }} />

        <SettingsUserManagement users={userList} />

        <PermissionsManager permissions={rolePermissions} />

        <RecruiterManager
          recruiters={recruiters.map((r) => ({
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            jobTitle: r.jobTitle,
          }))}
          allEmployees={employees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            jobTitle: e.jobTitle,
          }))}
        />

        <PipelineSettings
          initialStages={pipelineStages}
          initialCustomFields={candidateFields}
        />

        <NotificationSettings
          initialRules={notificationRules}
          initialRecipients={notificationRecipients}
          allEmployees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email }))}
        />

        <StageDocumentsManager
          documents={stageDocuments.map((d) => ({
            id: d.id,
            stage: d.stage,
            name: d.name,
            placeholders: d.placeholders,
            requiresSignature: d.requiresSignature,
            requiresFill: d.requiresFill,
            requiresCountersignature: d.requiresCountersignature,
            countersignerId: d.countersignerId,
            order: d.order,
            hasPdf: d.hasPdf,
          }))}
          countersigners={countersigners}
        />

        <DepartmentReviewTemplates
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          templates={deptReviewTemplates.map((t) => ({
            departmentId: t.departmentId,
            departmentName: t.department.name,
            name: t.name,
            selfTemplate: t.selfTemplate,
            managerTemplate: t.managerTemplate,
          }))}
        />

        <DepartmentManager
          departments={departments.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
          }))}
        />

        <JobTitleManager jobTitles={jobTitles} />

        <OnboardingSetup
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          employees={employeeList}
          jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
          checklistType="PRE_ONBOARDING"
        />

        <OnboardingSetup
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          employees={employeeList}
          jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
        />

        <OffboardingSetup
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          employees={employeeList}
          jobTitles={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
        />

        <PtoPolicyManager
          policies={policies.map((p) => ({
            id: p.id,
            name: p.name,
            daysPerYear: p.daysPerYear,
            isUnlimited: p.isUnlimited,
            documentUrl: p.documentUrl,
            documentName: p.documentName,
          }))}
        />

        <EmailTemplateManager templates={emailTemplates} userEmail={session.user.email || ""} />

        <PulseSurveyManager
          surveys={pulseSurveys.map((s) => ({
            id: s.id,
            question: s.question,
            status: s.status,
            createdAt: s.createdAt,
            _count: s._count,
          }))}
        />

        <Suspense>
          <NativeIntegrations
            connected={recruitmentPlatforms
              .filter((p) => SUPPORTED_PLATFORMS.some((sp) => sp.name === p.name))
              .map((p) => ({
                name: p.name,
                apiKey: p.apiKey,
                lastSyncAt: p.lastSyncAt,
                totalSynced: p.totalSynced,
              }))}
          />
        </Suspense>

        <CleanupDemoButton />

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

        <GustoConnection
          connection={gustoConnection ? {
            companyName: gustoConnection.companyName,
            createdAt: gustoConnection.createdAt,
            tokenExpiresAt: gustoConnection.tokenExpiresAt,
          } : null}
          mapping={gustoMapping}
        />
      </div>
    </div>
  );
}
