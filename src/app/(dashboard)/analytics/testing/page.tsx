import { cn } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import {
  getHeadcountByDepartment,
  getCostPerHire,
  getTimeToHireFromPosting,
  getQualityOfHire,
  getOfferAcceptanceRate,
  getNewHireTurnover,
  getTurnoverRates,
  getDemographics,
  getRetentionByManager,
  getEngagementMetrics,
  getTimeSincePromotion,
  getPerformanceOverview,
  getGoalTracking,
} from "@/lib/actions/analytics-testing";
import { getRetentionRate } from "@/lib/actions/analytics";
import { DepartmentBarChart } from "@/components/analytics/charts";
import {
  BucketBarChart,
  TurnoverByDeptChart,
  EngagementTrendChart,
} from "@/components/analytics/testing-charts";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";

function Section({ title, icon, children, note }: { title: string; icon: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon name={icon} size={16} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {note && <p className="text-xs text-[var(--color-text-muted)] mb-3">{note}</p>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

export default async function AnalyticsTestingPage() {
  await requireManagerOrAdmin();

  const [
    headcount,
    costPerHire,
    timeToHire,
    qualityOfHire,
    acceptance,
    newHireTurnover,
    turnover,
    demographics,
    retention,
    retentionByManager,
    engagement,
    promotions,
    performance,
    goals,
  ] = await Promise.all([
    getHeadcountByDepartment(),
    getCostPerHire(),
    getTimeToHireFromPosting(),
    getQualityOfHire(),
    getOfferAcceptanceRate(),
    getNewHireTurnover(),
    getTurnoverRates(),
    getDemographics(),
    getRetentionRate(),
    getRetentionByManager(),
    getEngagementMetrics(),
    getTimeSincePromotion(),
    getPerformanceOverview(),
    getGoalTracking(),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <PageHeader title="Analytics" description="Expanded HR metrics — hiring, turnover, retention, engagement, and performance" />
      <AnalyticsTabs />

      {/* Hiring KPIs */}
      <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Hiring &amp; Headcount</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Headcount" value={headcount.companywide} icon={<Icon name="group" size={20} />} color="blue" description="active companywide" />
        <StatCard title="Cost per Hire" value={`$${costPerHire.costPerHire.toLocaleString()}`} icon={<Icon name="attach_money" size={20} />} color="emerald" animate={false} description={`${costPerHire.periodHires} hires in the last 12 months`} />
        <StatCard title="Time to Hire" value={timeToHire.avgPostingToAcceptDays} suffix="days" icon={<Icon name="schedule" size={20} />} color="amber" description="posting to offer accepted" />
        <StatCard title="Quality of Hire" value={`${qualityOfHire.score}`} suffix="/100" icon={<Icon name="star" size={20} />} color="purple" animate={false} description={`${qualityOfHire.avgRating}/5 avg rating, ${qualityOfHire.retentionPct}% retained`} />
        <StatCard title="Acceptance Rate" value={`${acceptance.rate}%`} icon={<Icon name="handshake" size={20} />} color="cyan" animate={false} description={`${acceptance.accepted} of ${acceptance.extended} offers accepted`} />
        <StatCard title="Retention Rate" value={`${retention.retentionRate}%`} icon={<Icon name="target" size={20} />} color="emerald" animate={false} description="all time, companywide" />
      </div>

      {/* Turnover KPIs */}
      <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Turnover (last 12 months)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="Total Turnover" value={`${turnover.totalRate}%`} icon={<Icon name="trending_down" size={20} />} color="red" animate={false} description={`${turnover.departures} departures against an average headcount of ${turnover.avgHeadcount}`} />
        <StatCard title="Voluntary Turnover" value={`${turnover.voluntaryRate}%`} icon={<Icon name="logout" size={20} />} color="amber" animate={false} description={`${turnover.voluntary} voluntary, ${turnover.involuntary} involuntary, ${turnover.unclassified} unclassified`} />
        <StatCard title="Talent Turnover" value={`${turnover.talentRate}%`} icon={<Icon name="workspace_premium" size={20} />} color="rose" animate={false} description={`${turnover.talentDepartures} of ${turnover.talentPool} high performers left`} />
        <StatCard title="New Hire Turnover" value={`${newHireTurnover.firstYearTurnoverRate}%`} icon={<Icon name="person_remove" size={20} />} color="red" animate={false} description={`first-year exits against ${newHireTurnover.hiresLastYear} hires`} />
      </div>

      {/* Headcount by department + turnover by department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Headcount by Department" icon="group">
          <div className="min-h-[200px]">
            <DepartmentBarChart data={headcount.byDepartment} />
          </div>
        </Section>
        <Section title="Turnover Rate by Department" icon="trending_down" note="Departures over the last 12 months as a share of each department's workforce">
          <div className="min-h-[200px]">
            <TurnoverByDeptChart data={turnover.byDepartment} />
          </div>
        </Section>
      </div>

      {/* New hire turnover buckets + demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Section title="New Hire Turnover Windows" icon="person_remove" note="Departures by tenure at exit (cumulative, all time)">
          <BucketBarChart data={newHireTurnover.buckets} xKey="window" color="#F87171" />
        </Section>
        <Section title="Age Distribution" icon="cake">
          <BucketBarChart data={demographics.age} color="#6C83FF" />
        </Section>
        <Section title="Seniority (Length of Service)" icon="military_tech">
          <BucketBarChart data={demographics.seniority} color="#34D399" />
        </Section>
      </div>

      {/* Data-availability notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Gender & Education" icon="info" note="Not yet available">
          <p className="text-sm text-[var(--color-text-muted)]">
            Gender and education level aren&apos;t currently tracked in the HRIS employee profile,
            so these demographic breakdowns can&apos;t be reported yet. Adding those fields to the
            employee record would light this up.
          </p>
        </Section>
        <Section title="Absenteeism Rate" icon="event_busy" note="Future metric">
          <p className="text-sm text-[var(--color-text-muted)]">
            Unscheduled/unapproved absences can&apos;t be measured until the time &amp; attendance
            tool is synced with the HRIS. This card is a placeholder so the metric has a home when
            that integration lands.
          </p>
        </Section>
      </div>

      {/* Retention per manager */}
      <Section title="Retention Rate per Manager" icon="supervisor_account" note="Active direct reports vs everyone who has ever reported to each manager — lowest first">
        {retentionByManager.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)]">Manager</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Total Reports</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Still Here</th>
                  <th className="text-right py-2 font-medium text-[var(--color-text-muted)]">Retention</th>
                </tr>
              </thead>
              <tbody>
                {retentionByManager.map((m) => (
                  <tr key={m.name} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[var(--color-text-primary)]">{m.name}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-primary)]">{m.totalReports}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-primary)]">{m.activeReports}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        m.retentionRate >= 90 ? "bg-emerald-500/15 text-emerald-400" :
                        m.retentionRate >= 70 ? "bg-amber-500/15 text-amber-400" :
                        "bg-red-500/15 text-red-400"
                      )}>
                        {m.retentionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-[var(--color-text-muted)]">No managers with direct reports yet</p>}
      </Section>

      {/* Engagement & satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        <Section title="Employee Engagement" icon="sentiment_satisfied" note="Pulse survey mood (1-5) and participation across the last 6 surveys">
          {engagement.trend.length > 0 ? (
            <EngagementTrendChart data={engagement.trend} />
          ) : <p className="text-sm text-[var(--color-text-muted)]">No pulse surveys yet</p>}
        </Section>
        <Section title="Employee Satisfaction" icon="thumb_up" note="eNPS-style: % positive responses (mood 4-5) minus % negative (mood 1-2)">
          <div className="flex items-center gap-8 mb-4">
            <div>
              <p className={cn("text-3xl font-bold", engagement.satisfactionScore >= 0 ? "text-emerald-400" : "text-red-400")}>
                {engagement.satisfactionScore >= 0 ? "+" : ""}{engagement.satisfactionScore}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Satisfaction score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{engagement.avgMood}<span className="text-sm font-normal text-[var(--color-text-muted)]">/5</span></p>
              <p className="text-xs text-[var(--color-text-muted)]">Avg mood ({engagement.totalResponses} responses)</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)] w-24">Would recommend</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${engagement.promoterPct}%` }} />
              </div>
              <span className="text-xs font-medium text-emerald-400 w-10 text-right">{engagement.promoterPct}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)] w-24">Wouldn&apos;t</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${engagement.detractorPct}%` }} />
              </div>
              <span className="text-xs font-medium text-red-400 w-10 text-right">{engagement.detractorPct}%</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Promotions + performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Time Since Last Promotion" icon="trending_up" note={`Based on promotion announcements · ${promotions.promotedCount} of ${promotions.totalActive} active employees have a recorded promotion`}>
          <div className="mb-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{promotions.avgMonthsSincePromotion}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">months avg</span></p>
            <p className="text-xs text-[var(--color-text-muted)]">since last promotion (promoted employees)</p>
          </div>
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Longest without a promotion</h4>
          <div className="space-y-2">
            {promotions.longestWithout.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{p.jobTitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{p.months} mo</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{p.everPromoted ? "since promotion" : "never promoted (since start)"}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Employee Performance" icon="grade" note={`${performance.totalRated} rated reviews across self, manager, and peer assessments`}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {performance.avgByType.map((t) => (
              <div key={t.type} className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-center">
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{t.avg || "—"}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{t.type} ({t.count})</p>
              </div>
            ))}
          </div>
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Rating distribution</h4>
          <BucketBarChart data={performance.distribution} xKey="rating" color="#A78BFA" />
          {performance.topPerformers.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mt-4 mb-2">Top performers</h4>
              <div className="space-y-1.5">
                {performance.topPerformers.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-text-primary)]">{p.name}</span>
                    <span className="text-[var(--color-text-muted)]">{p.avgRating}/5 · {p.reviewCount} review{p.reviewCount !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      {/* Goal tracking */}
      <Section title="Goal Tracking" icon="flag" note="Goals documented through review cycles">
        <div className="flex items-center gap-8 mb-4">
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {goals.employeesWithGoals}
              <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">/ {goals.totalActive} employees</span>
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">have documented goals</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{goals.coveragePct}%</p>
            <p className="text-xs text-[var(--color-text-muted)]">goal coverage</p>
          </div>
        </div>
        {goals.recent.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {goals.recent.map((g) => (
              <div key={g.name} className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{g.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{g.cycle}</p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{g.goal}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-[var(--color-text-muted)]">No goals documented in reviews yet</p>}
      </Section>
    </div>
  );
}
