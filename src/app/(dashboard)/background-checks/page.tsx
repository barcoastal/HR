import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { listBackgroundChecks } from "@/lib/actions/background-checks";
import { isContinentalConfigured } from "@/lib/continental";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";
import {
  BackgroundChecksView,
  RefreshAllPendingButton,
} from "@/components/background-checks/background-checks-view";

export const dynamic = "force-dynamic";

export default async function BackgroundChecksPage() {
  const session = await requireManagerOrAdmin();
  const { rows, summary } = await listBackgroundChecks();
  const role = session.user?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const canViewReports = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const providerConfigured = isContinentalConfigured();
  const pendingCount = summary.AWAITING_APPLICANT + summary.PENDING;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="Background Checks"
        description="Every Continental Screening check in one place — where each one stands, what the vendor has returned, and the adverse-action trail."
        action={
          rows.length > 0 ? (
            <RefreshAllPendingButton pendingCount={pendingCount} providerConfigured={providerConfigured} />
          ) : undefined
        }
      />

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
        <BackgroundChecksView
          rows={rows}
          isSuperAdmin={isSuperAdmin}
          canViewReports={canViewReports}
          providerConfigured={providerConfigured}
        />
      )}
    </div>
  );
}
