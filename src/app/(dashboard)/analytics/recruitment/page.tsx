import { getRecruiterScope, requireManagerOrAdmin } from "@/lib/auth-helpers";
import {
  filtersToSearchParams,
  parseMetricsFilters,
  toIsoDay,
  type PerformanceRow,
  type ReportTableKey,
} from "@/lib/recruitment-metrics";
import { loadRecruitmentMetrics } from "@/lib/recruitment-metrics-data";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { RecruitmentFilters } from "@/components/analytics/recruitment-filters";
import {
  ApplicantsHiresChart,
  FunnelBarChart,
  RejectionReasonsChart,
} from "@/components/analytics/recruitment-metrics-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";

const th = "py-2 pr-4 font-medium text-[var(--color-text-muted)] whitespace-nowrap";
const td = "py-2 pr-4 text-[var(--color-text-primary)] whitespace-nowrap";

function fmt(n: number | null, suffix = ""): string {
  return n === null ? "—" : `${n.toLocaleString()}${suffix}`;
}
/** Range bounds are UTC days, so format them in UTC regardless of server zone. */
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function money(n: number | null): string {
  return n === null ? "—" : `$${Math.round(n).toLocaleString()}`;
}

function Section({
  title,
  icon,
  note,
  csvHref,
  children,
}: {
  title: string;
  icon: string;
  note?: React.ReactNode;
  csvHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)] p-5 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <Icon name={icon} size={16} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {csvHref && (
          <a
            href={csvHref}
            className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            title={`Download ${title} as CSV`}
          >
            <Icon name="download" size={14} />
            CSV
          </a>
        )}
      </div>
      {note && <p className="text-xs text-[var(--color-text-muted)] mb-3">{note}</p>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function PerformanceTable({ rows, firstHeader, showSpend }: { rows: PerformanceRow[]; firstHeader: string; showSpend: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">No candidates match these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-right">
            <th className={`${th} text-left`}>{firstHeader}</th>
            <th className={th}>Applicants</th>
            <th className={th} title="Of the applicants in this period, how many have been hired so far">Hired</th>
            <th className={th}>Conversion</th>
            <th className={th} title="Hired during this period, whenever they applied">Hires in period</th>
            {showSpend && <th className={th}>Spend</th>}
            <th className={th}>Cost / hire</th>
            <th className={`${th} pr-0`}>Avg days to hire</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-[var(--color-border)] last:border-0 text-right">
              <td className={`${td} text-left font-medium`}>{r.name}</td>
              <td className={td}>{r.applicants}</td>
              <td className={td}>{r.hiredFromApplicants}</td>
              <td className={td}>{fmt(r.conversion, "%")}</td>
              <td className={`${td} text-emerald-500 font-medium`}>{r.hiresInPeriod}</td>
              {showSpend && <td className={td}>{money(r.spend)}</td>}
              <td className={td}>{money(r.costPerHire)}</td>
              <td className={`${td} pr-0`}>{fmt(r.avgDaysToHire)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RecruitmentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManagerOrAdmin();
  const scope = await getRecruiterScope();
  const filters = parseMetricsFilters(await searchParams);
  const { metrics: m, options, scopedRecruiterId } = await loadRecruitmentMetrics(filters, scope);
  const f = m.filters;

  const query = filtersToSearchParams(f).toString();
  const csv = (table: ReportTableKey) => `/api/analytics/recruitment/export?format=csv&table=${table}&${query}`;
  const funnelNote = m.funnel.trackingSince ? (
    <>
      Of the people who applied in this period, how many reached each stage so far. Stage tracking since{" "}
      {formatDate(m.funnel.trackingSince)}
      {m.funnel.approximate && (
        <>
          {" "}· <span className="text-amber-500">Approximate:</span> {m.funnel.approximateCount} applicant
          {m.funnel.approximateCount === 1 ? "" : "s"} from before tracking began are counted by their current status only
          (rejected candidates may have reached later stages).
        </>
      )}
    </>
  ) : (
    <>
      Of the people who applied in this period, how many reached each stage so far.{" "}
      <span className="text-amber-500">Approximate:</span> no stage history has been recorded yet, so every candidate is counted by
      their current status.
    </>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <PageHeader title="Analytics" description="Recruitment funnel, sources, recruiters and time to hire — filter and export" />
      <AnalyticsTabs />

      <RecruitmentFilters
        key={query}
        initial={{
          preset: f.preset,
          from: toIsoDay(f.from),
          to: toIsoDay(f.to),
          position: f.positionId ?? "",
          source: f.source ?? "",
          recruiter: f.recruiterId ?? "",
          interval: f.interval,
        }}
        positions={options.positions}
        sources={options.sources}
        recruiters={options.recruiters}
        recruiterLocked={!!scopedRecruiterId}
        exportQuery={query}
      />

      <p className="text-xs text-[var(--color-text-muted)] -mt-3 mb-4">
        {toIsoDay(f.from) === toIsoDay(f.to) ? formatDate(f.from) : `${formatDate(f.from)} – ${formatDate(f.to)}`}
        {scopedRecruiterId && " · Showing only your candidates"}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard title="Applicants" value={m.summary.applicants} icon={<Icon name="person_add" size={20} />} color="blue" />
        <StatCard title="Hires" value={m.summary.hires} icon={<Icon name="how_to_reg" size={20} />} color="emerald" description="hired in period" />
        <StatCard title="Applicant → hire" value={fmt(m.summary.hireRate, "%")} icon={<Icon name="trending_up" size={20} />} color="purple" animate={false} />
        <StatCard title="Rejections" value={m.summary.rejections} icon={<Icon name="person_remove" size={20} />} color="red" />
        <StatCard title="Avg time to hire" value={fmt(m.summary.avgDaysToHire)} suffix={m.summary.avgDaysToHire === null ? undefined : "days"} icon={<Icon name="schedule" size={20} />} color="amber" animate={false} />
        <StatCard title="Median time to hire" value={fmt(m.summary.medianDaysToHire)} suffix={m.summary.medianDaysToHire === null ? undefined : "days"} icon={<Icon name="schedule" size={20} />} color="amber" animate={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Hiring funnel" icon="filter_alt" note={funnelNote} csvHref={csv("funnel")}>
          <FunnelBarChart data={m.funnel.steps} />
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right">
                  <th className={`${th} text-left`}>Stage</th>
                  <th className={th}>Candidates</th>
                  <th className={th}>From previous</th>
                  <th className={`${th} pr-0`}>From applicants</th>
                </tr>
              </thead>
              <tbody>
                {m.funnel.steps.map((s) => (
                  <tr key={s.key} className="border-b border-[var(--color-border)] last:border-0 text-right">
                    <td className={`${td} text-left font-medium`}>{s.label}</td>
                    <td className={td}>{s.count}</td>
                    <td className={td}>{fmt(s.conversionFromPrevious, "%")}</td>
                    <td className={`${td} pr-0`}>{fmt(s.conversionFromApplied, "%")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title={`Applicants and hires by ${f.interval}`}
          icon="show_chart"
          note="Applicants by application date; hires by hire date."
          csvHref={csv("over-time")}
        >
          <ApplicantsHiresChart data={m.overTime} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section
          title="Time in stage"
          icon="hourglass_empty"
          note="Days candidates spent in each stage, for stays that ended in this period. Based on stage history only."
          csvHref={csv("time-in-stage")}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right">
                  <th className={`${th} text-left`}>Stage</th>
                  <th className={th}>Completed stays</th>
                  <th className={th}>Average days</th>
                  <th className={`${th} pr-0`}>Median days</th>
                </tr>
              </thead>
              <tbody>
                {m.timeInStage.map((r) => (
                  <tr key={r.status} className="border-b border-[var(--color-border)] last:border-0 text-right">
                    <td className={`${td} text-left font-medium`}>{r.label}</td>
                    <td className={td}>{r.stays}</td>
                    <td className={td}>{fmt(r.avgDays)}</td>
                    <td className={`${td} pr-0`}>{fmt(r.medianDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Rejection reasons"
          icon="block"
          note={`${m.rejectionReasons.total} candidate${m.rejectionReasons.total === 1 ? "" : "s"} rejected in this period (latest reason per candidate).`}
          csvHref={csv("rejection-reasons")}
        >
          {m.rejectionReasons.total > 0 ? (
            <>
              <RejectionReasonsChart data={m.rejectionReasons.rows} />
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right">
                      <th className={`${th} text-left`}>Reason</th>
                      <th className={th}>Rejections</th>
                      <th className={`${th} pr-0`}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.rejectionReasons.rows.map((r) => (
                      <tr key={r.code} className="border-b border-[var(--color-border)] last:border-0 text-right">
                        <td className={`${td} text-left font-medium`}>{r.label}</td>
                        <td className={td}>{r.count}</td>
                        <td className={`${td} pr-0`}>{fmt(r.percent, "%")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No rejections in this period.</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Section
          title="Source performance"
          icon="cable"
          note={
            f.positionId || f.recruiterId
              ? "Spend is the recorded cost of hire for hires in this period. Platform subscriptions aren't included while a position or recruiter filter is on."
              : "Spend is the recorded cost of hire for hires in this period plus recruitment-platform cost for the months in range (platforms match by source name)."
          }
          csvHref={csv("sources")}
        >
          <PerformanceTable rows={m.sources} firstHeader="Source" showSpend />
        </Section>

        <Section
          title="Recruiter performance"
          icon="bar_chart"
          note="Cost per hire uses each hire's recorded cost of hire."
          csvHref={csv("recruiters")}
        >
          <PerformanceTable rows={m.recruiters} firstHeader="Recruiter" showSpend={false} />
        </Section>
      </div>
    </div>
  );
}
