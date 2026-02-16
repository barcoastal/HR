import { cn, formatDate } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import {
  getHeadcountStats,
  getDepartmentBreakdown,
  getTenureDistribution,
  getOnboardingMetrics,
  getReviewMetrics,
  getHiringPipelineStats,
  getSourceROI,
  getTimeToHire,
  getRetentionRate,
  getTurnoverByMonth,
  getUpcomingBirthdays,
  getUpcomingAnniversaries,
  getDietaryRestrictions,
  getRecruiterAnalytics,
  getBenefitsEligibility,
} from "@/lib/actions/analytics";
import {
  Users, TrendingUp, TrendingDown, UserPlus, UserMinus,
  Cake, CalendarHeart, Clock, DollarSign, Target, Briefcase,
  UtensilsCrossed, BarChart3, Shield,
} from "lucide-react";
import {
  DepartmentBarChart,
  TenureBarChart,
  PipelinePieChart,
  TurnoverLineChart,
  SourceROIChart,
  DietaryPieChart,
} from "@/components/analytics/charts";

export default async function AnalyticsPage() {
  await requireManagerOrAdmin();

  const [
    headcount,
    deptBreakdown,
    tenure,
    onboarding,
    reviews,
    pipeline,
    sourceROI,
    timeToHire,
    retention,
    turnover,
    birthdays,
    anniversaries,
    dietary,
    recruiterStats,
    benefitsEligibility,
  ] = await Promise.all([
    getHeadcountStats(),
    getDepartmentBreakdown(),
    getTenureDistribution(),
    getOnboardingMetrics(),
    getReviewMetrics(),
    getHiringPipelineStats(),
    getSourceROI(),
    getTimeToHire(),
    getRetentionRate(),
    getTurnoverByMonth(),
    getUpcomingBirthdays(),
    getUpcomingAnniversaries(),
    getDietaryRestrictions(),
    getRecruiterAnalytics(),
    getBenefitsEligibility(),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Analytics</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Comprehensive HR metrics and recruitment analytics</p>
      </div>

      {/* Headcount Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: "Total Employees", value: headcount.total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Active", value: headcount.active, icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "New This Month", value: headcount.newThisMonth, icon: UserPlus, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Departed", value: headcount.departedThisMonth, icon: UserMinus, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Net Growth", value: headcount.netGrowthMonth >= 0 ? `+${headcount.netGrowthMonth}` : String(headcount.netGrowthMonth), icon: headcount.netGrowthMonth >= 0 ? TrendingUp : TrendingDown, color: headcount.netGrowthMonth >= 0 ? "text-emerald-400" : "text-red-400", bg: headcount.netGrowthMonth >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
          { label: "Retention", value: `${retention.retentionRate}%`, icon: Target, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", stat.bg)}>
                <Icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recruitment KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Avg Time to Hire</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">{timeToHire.avgDays}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">days</span></p>
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Avg Cost per Hire</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            ${sourceROI.length > 0 ? Math.round(sourceROI.reduce((a, s) => a + s.totalCost, 0) / Math.max(sourceROI.reduce((a, s) => a + s.hired, 0), 1)).toLocaleString() : "0"}
          </p>
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Open Positions</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">{pipeline.filter((p) => !["HIRED", "REJECTED"].includes(p.status)).reduce((a, p) => a + p.count, 0)}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">active candidates</span></p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Department Breakdown</h3>
          <DepartmentBarChart data={deptBreakdown} />
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Turnover Trend (6 Months)</h3>
          <TurnoverLineChart data={turnover} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Tenure Distribution</h3>
          <TenureBarChart data={tenure} />
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Hiring Pipeline</h3>
          <PipelinePieChart data={pipeline} />
        </div>
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Dietary Restrictions</h3>
          <DietaryPieChart data={dietary.summary} />
        </div>
      </div>

      {/* Source ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Source ROI</h3>
          <SourceROIChart data={sourceROI} />
          <div className="mt-4 space-y-2">
            {sourceROI.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-primary)] font-medium">{s.source}</span>
                <div className="flex items-center gap-4 text-[var(--color-text-muted)]">
                  <span>{s.conversionRate}% conversion</span>
                  <span>${s.avgCostPerHire} avg cost</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recruiter Analytics */}
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recruiter Performance</h3>
          </div>
          {recruiterStats.length > 0 ? (
            <div className="space-y-4">
              {recruiterStats.map((r) => (
                <div key={r.name} className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{r.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[var(--color-text-muted)]">Candidates:</span> <span className="font-medium text-[var(--color-text-primary)]">{r.totalCandidates}</span></div>
                    <div><span className="text-[var(--color-text-muted)]">Hired:</span> <span className="font-medium text-emerald-400">{r.hired}</span></div>
                    <div><span className="text-[var(--color-text-muted)]">Conversion:</span> <span className="font-medium text-[var(--color-text-primary)]">{r.conversionRate}%</span></div>
                    <div><span className="text-[var(--color-text-muted)]">Avg Time:</span> <span className="font-medium text-[var(--color-text-primary)]">{r.avgTimeToHire}d</span></div>
                    <div className="col-span-2"><span className="text-[var(--color-text-muted)]">Total Cost:</span> <span className="font-medium text-[var(--color-text-primary)]">${r.totalCost.toLocaleString()}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-muted)]">No recruiter data yet</p>}
        </div>
      </div>

      {/* Review Metrics */}
      {reviews.length > 0 && (
        <div className={cn("rounded-xl p-5 mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Review Completion</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {reviews.map((r) => (
              <div key={r.name} className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1">{r.name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${r.completionRate}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{r.completionRate}%</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{r.submitted}/{r.total} submitted</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding Metrics */}
      <div className={cn("rounded-xl p-5 mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Onboarding Pipeline</h3>
        <div className="flex items-center gap-6 mb-3">
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{onboarding.activeCount}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Currently onboarding</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{onboarding.avgCompletion}%</p>
            <p className="text-xs text-[var(--color-text-muted)]">Avg completion</p>
          </div>
        </div>
        {onboarding.employees.length > 0 && (
          <div className="space-y-2">
            {onboarding.employees.map((emp) => (
              <div key={emp.name} className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-primary)] w-32 truncate">{emp.name}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-background)] overflow-hidden">
                  <div className={cn("h-full rounded-full", emp.progress >= 80 ? "bg-emerald-500" : emp.progress >= 50 ? "bg-amber-500" : "bg-blue-500")} style={{ width: `${emp.progress}%` }} />
                </div>
                <span className="text-xs text-[var(--color-text-muted)] w-16 text-right">{emp.done}/{emp.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benefits Eligibility */}
      <div className={cn("rounded-xl p-5 mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Benefits Eligibility</h3>
        </div>
        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {benefitsEligibility.totalEligible}
              <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">
                / {benefitsEligibility.totalActive} active
              </span>
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Currently eligible</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{benefitsEligibility.eligibilityRate}%</p>
            <p className="text-xs text-[var(--color-text-muted)]">Eligibility rate</p>
          </div>
        </div>
        {benefitsEligibility.upcoming.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Upcoming Eligibility
            </h4>
            <div className="space-y-2">
              {benefitsEligibility.upcoming.slice(0, 8).map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{u.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{u.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-text-primary)]">{formatDate(u.eligibleDate)}</p>
                    <p className="text-[10px] text-emerald-400 font-medium">
                      in {u.daysUntil} day{u.daysUntil !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Birthdays & Anniversaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <Cake className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Upcoming Birthdays</h3>
          </div>
          {birthdays.length > 0 ? (
            <div className="space-y-3">
              {birthdays.slice(0, 8).map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{b.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{b.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-text-primary)]">{formatDate(b.birthday)}</p>
                    <p className="text-[10px] text-amber-400 font-medium">
                      {b.daysUntil === 0 ? "Today!" : `in ${b.daysUntil} day${b.daysUntil > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-muted)]">No upcoming birthdays</p>}
        </div>

        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarHeart className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Upcoming Work Anniversaries</h3>
          </div>
          {anniversaries.length > 0 ? (
            <div className="space-y-3">
              {anniversaries.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{a.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{a.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-rose-400 font-medium">{a.years} year{a.years !== 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{formatDate(a.anniversaryDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-muted)]">No upcoming anniversaries</p>}
        </div>
      </div>
    </div>
  );
}
