import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { listBackgroundChecks } from "@/lib/actions/background-checks";
import { listBackgroundCheckDocuments, listI9Overview } from "@/lib/actions/compliance";
import { isContinentalConfigured } from "@/lib/continental";
import { COMPLIANCE_TABS, complianceTab } from "@/lib/compliance";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";
import { I9FormsView } from "@/components/compliance/i9-forms-view";
import {
  BackgroundChecksView,
  RefreshAllPendingButton,
} from "@/components/background-checks/background-checks-view";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** I-9 forms and background checks — Super Admins only, kept apart from the regular HR documents. */
export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSuperAdmin();
  const { tab } = await searchParams;
  const active = complianceTab(tab);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="I-9 & Background Checks"
        description="Employment eligibility forms and background-check results. Only Super Admins can see this page or these files — admins, HR, managers and the employees themselves cannot."
      />
      <nav aria-label="I-9 & Background Checks sections" className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {COMPLIANCE_TABS.map((t) => {
          const selected = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/compliance?tab=${t.id}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                selected
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t.label}
              {selected && (
                <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </nav>
      {active === "i9" ? <I9Section /> : <BackgroundChecksSection />}
    </div>
  );
}

async function I9Section() {
  const { rows, missing, total } = await listI9Overview();
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard title="Employees" value={total} icon={<Icon name="group" size={20} />} color="blue" />
        <StatCard title="I-9 on file" value={total - missing} icon={<Icon name="check_circle" size={20} />} color="emerald" />
        <StatCard title="Missing an I-9" value={missing} icon={<Icon name="warning" size={20} />} color="amber" />
      </div>
      <I9FormsView rows={rows} />
    </>
  );
}

async function BackgroundChecksSection() {
  const { rows, summary } = await listBackgroundChecks();
  const providerConfigured = isContinentalConfigured();
  const pendingCount = summary.AWAITING_APPLICANT + summary.PENDING;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
          Every Continental Screening check in one place — where each one stands, what the vendor has returned, and the
          adverse-action trail.
        </p>
        {rows.length > 0 && (
          <RefreshAllPendingButton pendingCount={pendingCount} providerConfigured={providerConfigured} />
        )}
      </div>

      {!providerConfigured && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700">
          <Icon name="info" size={16} className="shrink-0" />
          <p>
            Continental Screening credentials are not configured on this server. Stored results are shown, but
            checks cannot be refreshed from the vendor.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        <StatCard title="Awaiting applicant" value={summary.AWAITING_APPLICANT} icon={<Icon name="hourglass_top" size={20} />} color="amber" />
        <StatCard title="In progress" value={summary.PENDING} icon={<Icon name="pending" size={20} />} color="blue" />
        <StatCard title="Passed" value={summary.PASSED} icon={<Icon name="check_circle" size={20} />} color="emerald" />
        <StatCard title="Flagged" value={summary.FAILED} icon={<Icon name="flag" size={20} />} color="red" />
        <StatCard title="Errors" value={summary.ERROR} icon={<Icon name="error" size={20} />} color="rose" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="verified_user" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No background checks yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
            A check appears here as soon as a candidate is moved to the Background Check stage in Recruitment and
            the Continental invitation goes out.
          </p>
        </div>
      ) : (
        <BackgroundChecksView rows={rows} isSuperAdmin canViewReports providerConfigured={providerConfigured} />
      )}

      <BackgroundCheckDocumentsSection />
    </>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Files filed in each employee's "Background check" folder on their profile. */
async function BackgroundCheckDocumentsSection() {
  const groups = await listBackgroundCheckDocuments();
  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Background check documents on employee profiles</h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Files uploaded to a person&apos;s Background check folder. Upload or remove them from the person&apos;s profile.
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          No background check documents have been filed on employee profiles.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {groups.map((g) => (
            <li key={g.employeeId} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start">
              <div className="min-w-0 md:w-72 md:shrink-0">
                <Link
                  href={`/people/${g.employeeId}`}
                  className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                >
                  {g.name}
                </Link>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{g.jobTitle}</p>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {g.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                    <Icon name="description" size={14} className="text-[var(--color-text-muted)] shrink-0" />
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline"
                    >
                      {doc.name}
                    </a>
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatDate(doc.uploadedAt)}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
