import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "company", label: "Company", description: "Brand and sender identity", icon: "business" },
  { id: "access", label: "People & Access", description: "Users, roles, and permissions", icon: "admin_panel_settings" },
  { id: "organization", label: "Organization", description: "Departments and job titles", icon: "account_tree" },
  { id: "recruitment", label: "Recruitment", description: "Recruiters, pipeline, and notices", icon: "work" },
  { id: "documents", label: "Documents", description: "Stage and position documents", icon: "description" },
  { id: "workflows", label: "Employee Workflows", description: "Written Offer through offboarding", icon: "assignment_turned_in" },
  { id: "email", label: "Email", description: "Templates and delivery activity", icon: "outgoing_mail" },
  { id: "integrations", label: "Integrations", description: "Connected platforms and payroll", icon: "cable" },
  { id: "policies", label: "Policies & Feedback", description: "PTO, reviews, and pulse surveys", icon: "policy" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export const SETTINGS_PANELS: Partial<Record<SettingsSectionId, readonly { id: string; label: string }[]>> = {
  access: [
    { id: "users", label: "Users" },
    { id: "permissions", label: "Permissions" },
  ],
  organization: [
    { id: "departments", label: "Departments" },
    { id: "job-titles", label: "Job Titles" },
  ],
  recruitment: [
    { id: "recruiters", label: "Recruiters" },
    { id: "pipeline", label: "Pipeline" },
    { id: "notifications", label: "Notifications" },
  ],
  documents: [
    { id: "stage-documents", label: "Stage Documents" },
    { id: "position-documents", label: "Position Documents" },
  ],
  workflows: [
    { id: "written-offer", label: "Written Offer" },
    { id: "onboarding", label: "Onboarding" },
    { id: "offboarding", label: "Offboarding" },
  ],
  email: [
    { id: "templates", label: "Templates" },
    { id: "delivery", label: "Delivery Activity" },
  ],
  integrations: [
    { id: "connected-apps", label: "Connected Apps" },
    { id: "platform-accounts", label: "Platform Accounts" },
    { id: "payroll", label: "Payroll" },
  ],
  policies: [
    { id: "pto", label: "PTO" },
    { id: "reviews", label: "Reviews" },
    { id: "pulse", label: "Pulse Surveys" },
  ],
};

export function SettingsSubnavigation({
  section,
  activePanel,
}: {
  section: SettingsSectionId;
  activePanel: string;
}) {
  const panels = SETTINGS_PANELS[section];
  if (!panels || panels.length < 2) return null;

  return (
    <nav aria-label={`${section} settings`} className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      {panels.map((panel) => {
        const selected = panel.id === activePanel;
        return (
          <Link
            key={panel.id}
            href={`/settings?section=${section}&panel=${panel.id}`}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]",
              selected
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {panel.label}
            {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsNavigation({
  active,
  mobile = false,
}: {
  active: SettingsSectionId;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <nav aria-label="Settings sections" className="mb-6 overflow-x-auto pb-1 lg:hidden">
        <div className="flex min-w-max gap-2">
          {SETTINGS_SECTIONS.map((section) => {
            const selected = active === section.id;
            return (
              <Link
                key={section.id}
                href={`/settings?section=${section.id}`}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
                  selected
                    ? "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Icon name={section.icon} size={17} fill={selected} />
                {section.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <aside className="sticky top-20 hidden self-start lg:block">
      <nav aria-label="Settings sections" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        {SETTINGS_SECTIONS.map((section) => {
          const selected = active === section.id;
          return (
            <Link
              key={section.id}
              href={`/settings?section=${section.id}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]",
                selected
                  ? "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon name={section.icon} size={19} fill={selected} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{section.label}</span>
                <span className={cn("mt-0.5 block text-xs leading-4", selected ? "text-current opacity-75" : "text-[var(--color-text-muted)]")}>
                  {section.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function SettingsSectionHeader({
  active,
  action,
}: {
  active: SettingsSectionId;
  action?: ReactNode;
}) {
  const section = SETTINGS_SECTIONS.find((item) => item.id === active)!;
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{section.label}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{section.description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
