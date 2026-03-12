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
  getBlendedCostPerHire,
} from "@/lib/actions/analytics";
import {
  getPlatformSpendDashboard,
  getPlatformSpendVsHiresTrend,
} from "@/lib/actions/recruitment-platforms";
import {
  Users, TrendingUp, TrendingDown, UserPlus, UserMinus,
  Cake, CalendarHeart, Clock, DollarSign, Target, Briefcase,
  UtensilsCrossed, BarChart3, Shield, Cable,
} from "lucide-react";
import {
  DepartmentBarChart,
  TenureBarChart,
  PipelinePieChart,
  TurnoverLineChart,
  SourceROIChart,
  DietaryPieChart,
} from "@/components/analytics/charts";
import { SpendVsHiresChart } from "@/components/analytics/recruitment-cost-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { AIAnalyticsBar } from "@/components/analytics/ai-analytics-bar";

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
    blendedCost,
    platformSpend,
    spendTrend,
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
    getBlendedCostPerHire(),
    getPlatformSpendDashboard(),
    getPlatformSpendVsHiresTrend(),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <PageHeader title="Analytics" description="Comprehensive HR metrics and recruitment analytics" />

      {/* Headcount Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Employees" value={headcount.total} icon={Users} color="blue" />
        <StatCard title="Active" value={headcount.active} icon={Users} color="emerald" />
        <StatCard title="New This Month" value={headcount.newThisMonth} icon={UserPlus} color="emerald" />
        <StatCard title="Departed" value={headcount.departedThisMonth} icon={UserMinus} color="red" />
        <StatCard title="Net Growth" value={headcount.netGrowthMonth >= 0 ? `+${headcount.netGrowthMonth}` : String(headcount.netGrowthMonth)} icon={headcount.netGrowthMonth >= 0 ? TrendingUp : TrendingDown} color={headcount.netGrowthMonth >= 0 ? "emerald" : "red"} animate={false} />
        <StatCard title="Retention" value={`${retention.retentionRate}%`} icon={Target} color="purple" animate={false} />
      </div>

      {/* Recruitment KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Avg Time to Hire" value={timeToHire.avgDays} icon={Clock} color="amber" suffix="days" />
        <StatCard title="Blended Cost/Hire" value={`$${blendedCost.blendedCostPerHire.toLocaleString()}`} icon={DollarSign} color="emerald" animate={false} description={`Direct: $${blendedCost.directCostPerHire.toLocaleString()} · Platform: $${blendedCost.platformCostPerHire.toLocaleString()}`} />
        <StatCard title="Open Positions" value={pipeline.filter((p) => !["HIRED", "REJECTED"].includes(p.status)).reduce((a, p) => a + p.count, 0)} icon={Briefcase} color="blue" description="active candidates" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Department Breakdown</h3>
          <div className="min-h-[200px]">
            <DepartmentBarChart data={deptBreakdown} />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Turnover Trend (6 Months)</h3>
          <div className="min-h-[200px]">
            <TurnoverLineChart data={turnover} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Tenure Distribution</h3>
          <div className="min-h-[200px]">
            <TenureBarChart data={tenure} />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Hiring Pipeline</h3>
          <div className="min-h-[200px]">
            <PipelinePieChart data={pipeline} />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Dietary Restrictions</h3>
          <div className="min-h-[200px]">
            <DietaryPieChart data={dietary.summary} />
          </div>
        </div>
      </div>

      {/* Source ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="gradient-border rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Source ROI</h3>
          <div className="min-h-[200px]">
            <SourceROIChart data={sourceROI} />
          </div>
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
        <div className="gradient-border rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]">
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

      {/* Recruitment Platform Spend */}
      {platformSpend.platforms.length > 0 && (
        <div className="gradient-border rounded-2xl p-5 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cable className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recruitment Platform Spend</h3>
            </div>
            <span className={cn("px-2 py-1 rounded-lg text-xs font-medium", "bg-[var(--color-accent)]/10 text-[var(--color-accent)]")}>
              ${platformSpend.totalMonthlySpend.toLocaleString()}/mo total
            </span>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3 mb-6">
            {platformSpend.platforms.map((p) => (
              <div key={p.id} className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", p.status === "ACTIVE" ? "bg-emerald-400" : p.status === "PAUSED" ? "bg-amber-400" : "bg-red-400")} />
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">{p.name}</span>
                  </div>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    p.roi === "Efficient" ? "bg-emerald-500/15 text-emerald-400" :
                    p.roi === "Moderate" ? "bg-amber-500/15 text-amber-400" :
                    "bg-red-500/15 text-red-400"
                  )}>
                    {p.roi}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Type:</span>
                    <span className="ml-1 text-[var(--color-text-primary)]">{p.type.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Monthly:</span>
                    <span className="ml-1 text-[var(--color-text-primary)]">${p.monthlyCost.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Candidates:</span>
                    <span className="ml-1 text-[var(--color-text-primary)]">{p.candidatesSourced}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Hires:</span>
                    <span className="ml-1 font-medium text-emerald-400">{p.hired}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--color-text-muted)]">Cost/Hire:</span>
                    <span className="ml-1 text-[var(--color-text-primary)]">${p.blendedCostPerHire.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)]">Platform</th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-muted)]">Type</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Monthly Cost</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Candidates</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Hires</th>
                  <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-muted)]">Cost/Hire</th>
                  <th className="text-right py-2 font-medium text-[var(--color-text-muted)]">ROI</th>
                </tr>
              </thead>
              <tbody>
                {platformSpend.platforms.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", p.status === "ACTIVE" ? "bg-emerald-400" : p.status === "PAUSED" ? "bg-amber-400" : "bg-red-400")} />
                        <span className="font-medium text-[var(--color-text-primary)]">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">{p.type.replace("_", " ")}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-primary)]">${p.monthlyCost.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-primary)]">{p.candidatesSourced}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-emerald-400">{p.hired}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-primary)]">${p.blendedCostPerHire.toLocaleString()}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        p.roi === "Efficient" ? "bg-emerald-500/15 text-emerald-400" :
                        p.roi === "Moderate" ? "bg-amber-500/15 text-amber-400" :
                        "bg-red-500/15 text-red-400"
                      )}>
                        {p.roi}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Spend vs Hires (12 Months)</h4>
            <div className="min-h-[200px]">
              <SpendVsHiresChart data={spendTrend} />
            </div>
          </div>
        </div>
      )}

      {/* Review Metrics */}
      {reviews.length > 0 && (
        <div className="gradient-border rounded-2xl p-5 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Review Completion</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
      <div className="gradient-border rounded-2xl p-5 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
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
      <div className="gradient-border rounded-2xl p-5 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
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
        <div className="gradient-border rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]">
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

        <div className="gradient-border rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]">
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

      {/* AI Analytics Assistant */}
      <AIAnalyticsBar
        context={{
          headcount,
          retention,
          timeToHire,
          departments: deptBreakdown,
          turnover,
          pipeline,
          blendedCost,
          onboarding,
          reviews,
          recruiterStats,
        }}
      />
    </div>
  );
}
