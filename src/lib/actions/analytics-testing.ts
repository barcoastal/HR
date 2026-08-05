"use server";

import { db } from "@/lib/db";

// Only count employees with user accounts (matches analytics.ts)
const hasUser = { user: { isNot: null } } as const;

const DAY = 1000 * 60 * 60 * 24;

function monthsBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (DAY * 30.44)));
}

// Headcount at a point in time: started on/before that date and not yet departed.
async function headcountAt(date: Date) {
  return db.employee.count({
    where: {
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gt: date } }],
      ...hasUser,
    },
  });
}

// ---------------------------------------------------------------------------
// Headcount: companywide and per department
// ---------------------------------------------------------------------------
export async function getHeadcountByDepartment() {
  const [companywide, departments, noDepartment] = await Promise.all([
    db.employee.count({ where: { status: { not: "OFFBOARDED" }, ...hasUser } }),
    db.department.findMany({
      include: {
        employees: { where: { status: { not: "OFFBOARDED" }, ...hasUser }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.employee.count({
      where: { status: { not: "OFFBOARDED" }, departmentId: null, ...hasUser },
    }),
  ]);

  const byDepartment = departments.map((d) => ({ name: d.name, count: d.employees.length }));
  if (noDepartment > 0) byDepartment.push({ name: "Unassigned", count: noDepartment });

  return { companywide, byDepartment };
}

// ---------------------------------------------------------------------------
// Cost per hire: (internal + external costs) / hires in the period
// ---------------------------------------------------------------------------
export async function getCostPerHire() {
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const [hiredLastYear, hiredAllTime, activePlatforms] = await Promise.all([
    db.candidate.findMany({
      where: { status: "HIRED", hiredAt: { gte: yearAgo } },
      select: { costOfHire: true },
    }),
    db.candidate.findMany({ where: { status: "HIRED" }, select: { costOfHire: true } }),
    db.recruitmentPlatform.findMany({
      where: { status: "ACTIVE" },
      select: { monthlyCost: true },
    }),
  ]);

  // External/direct costs recorded per candidate; internal costs approximated by
  // 12 months of platform subscription spend.
  const directCost = hiredLastYear.reduce((s, c) => s + (c.costOfHire || 0), 0);
  const platformCostYear = activePlatforms.reduce((s, p) => s + p.monthlyCost, 0) * 12;
  const hires = hiredLastYear.length;

  const allTimeDirect = hiredAllTime.reduce((s, c) => s + (c.costOfHire || 0), 0);

  return {
    periodHires: hires,
    directCost: Math.round(directCost),
    platformCostYear: Math.round(platformCostYear),
    costPerHire: hires > 0 ? Math.round((directCost + platformCostYear) / hires) : 0,
    allTimeCostPerHire:
      hiredAllTime.length > 0 ? Math.round(allTimeDirect / hiredAllTime.length) : 0,
  };
}

// ---------------------------------------------------------------------------
// Time to hire: days from posting the job to the candidate accepting the offer
// ---------------------------------------------------------------------------
export async function getTimeToHireFromPosting() {
  const hired = await db.candidate.findMany({
    where: { status: "HIRED" },
    select: {
      appliedAt: true,
      hiredAt: true,
      offerSignedAt: true,
      position: { select: { title: true, createdAt: true } },
    },
  });

  const postingToAccept: number[] = [];
  const applyToHire: number[] = [];

  for (const c of hired) {
    const accepted = c.offerSignedAt ?? c.hiredAt;
    if (!accepted) continue;
    if (c.position) {
      const days = Math.round((accepted.getTime() - c.position.createdAt.getTime()) / DAY);
      if (days >= 0) postingToAccept.push(days);
    }
    const applyDays = Math.round((accepted.getTime() - c.appliedAt.getTime()) / DAY);
    if (applyDays >= 0) applyToHire.push(applyDays);
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  return {
    avgPostingToAcceptDays: avg(postingToAccept),
    avgApplyToAcceptDays: avg(applyToHire),
    sampleSize: postingToAccept.length,
  };
}

// ---------------------------------------------------------------------------
// Quality of hire: performance + retention of employees hired in the last year
// ---------------------------------------------------------------------------
export async function getQualityOfHire() {
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const newHires = await db.employee.findMany({
    where: { startDate: { gte: yearAgo }, ...hasUser },
    select: {
      id: true,
      status: true,
      reviewsAsEmployee: {
        where: { status: "SUBMITTED", rating: { not: null } },
        select: { rating: true },
      },
    },
  });

  const ratings = newHires
    .filter((e) => e.reviewsAsEmployee.length > 0)
    .map(
      (e) =>
        e.reviewsAsEmployee.reduce((s, r) => s + (r.rating || 0), 0) / e.reviewsAsEmployee.length
    );

  const avgRating = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;
  const stillHere = newHires.filter((e) => e.status !== "OFFBOARDED").length;
  const retentionPct = newHires.length ? Math.round((stillHere / newHires.length) * 100) : 0;
  // Composite: average of the performance score (rating as % of 5) and retention %
  const ratingPct = Math.round((avgRating / 5) * 100);
  const score =
    ratings.length > 0 ? Math.round((ratingPct + retentionPct) / 2) : retentionPct;

  return {
    newHireCount: newHires.length,
    ratedCount: ratings.length,
    avgRating,
    retentionPct,
    score,
  };
}

// ---------------------------------------------------------------------------
// Offer acceptance rate: offers accepted / offers extended
// ---------------------------------------------------------------------------
export async function getOfferAcceptanceRate() {
  const offers = await db.candidate.findMany({
    where: { offerSentAt: { not: null } },
    select: { offerSignedAt: true, hiredAt: true, status: true },
  });

  const extended = offers.length;
  const accepted = offers.filter(
    (o) => o.offerSignedAt || o.hiredAt || o.status === "HIRED"
  ).length;

  return {
    extended,
    accepted,
    rate: extended > 0 ? Math.round((accepted / extended) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// New hire turnover: departures within 30/60/90 days, 6 months, first year
// ---------------------------------------------------------------------------
export async function getNewHireTurnover() {
  const departed = await db.employee.findMany({
    where: { status: "OFFBOARDED", endDate: { not: null }, ...hasUser },
    select: { startDate: true, endDate: true },
  });

  const buckets = { "≤30 days": 0, "≤60 days": 0, "≤90 days": 0, "≤6 months": 0, "≤1 year": 0 };
  for (const e of departed) {
    const tenureDays = (e.endDate!.getTime() - e.startDate.getTime()) / DAY;
    if (tenureDays <= 30) buckets["≤30 days"]++;
    if (tenureDays <= 60) buckets["≤60 days"]++;
    if (tenureDays <= 90) buckets["≤90 days"]++;
    if (tenureDays <= 182) buckets["≤6 months"]++;
    if (tenureDays <= 365) buckets["≤1 year"]++;
  }

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const [hiresLastYear, firstYearExitsLastYear] = await Promise.all([
    db.employee.count({ where: { startDate: { gte: yearAgo }, ...hasUser } }),
    db.employee.count({
      where: {
        status: "OFFBOARDED",
        endDate: { gte: yearAgo },
        startDate: { gte: new Date(yearAgo.getTime() - 365 * DAY) },
        ...hasUser,
      },
    }),
  ]);

  return {
    buckets: Object.entries(buckets).map(([window, count]) => ({ window, count })),
    firstYearTurnoverRate:
      hiresLastYear > 0 ? Math.round((firstYearExitsLastYear / hiresLastYear) * 100) : 0,
    hiresLastYear,
  };
}

// ---------------------------------------------------------------------------
// Turnover rates: total, voluntary, talent, and per department (last 12 months)
// ---------------------------------------------------------------------------
const VOLUNTARY_HINTS = ["resign", "quit", "voluntar", "new job", "another opportunit", "relocat", "personal"];
const INVOLUNTARY_HINTS = ["terminat", "fired", "layoff", "laid off", "performance", "dismiss", "restructur"];

export async function getTurnoverRates() {
  const now = new Date();
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const [departedInPeriod, startHeadcount, endHeadcount] = await Promise.all([
    db.employee.findMany({
      where: { status: "OFFBOARDED", endDate: { gte: yearAgo }, ...hasUser },
      select: {
        id: true,
        archivedReason: true,
        department: { select: { name: true } },
        reviewsAsEmployee: {
          where: { status: "SUBMITTED", rating: { not: null } },
          select: { rating: true },
        },
      },
    }),
    headcountAt(yearAgo),
    headcountAt(now),
  ]);

  const avgHeadcount = (startHeadcount + endHeadcount) / 2;
  const departures = departedInPeriod.length;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  // Voluntary vs involuntary, classified from the archived/offboarding reason text
  let voluntary = 0;
  let involuntary = 0;
  let unclassified = 0;
  for (const e of departedInPeriod) {
    const reason = (e.archivedReason || "").toLowerCase();
    if (VOLUNTARY_HINTS.some((h) => reason.includes(h))) voluntary++;
    else if (INVOLUNTARY_HINTS.some((h) => reason.includes(h))) involuntary++;
    else unclassified++;
  }

  // Talent turnover: departures whose average review rating was 4+
  const isHighPerformer = (reviews: { rating: number | null }[]) => {
    const rated = reviews.filter((r) => r.rating !== null);
    if (!rated.length) return false;
    return rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length >= 4;
  };
  const departedTalent = departedInPeriod.filter((e) => isHighPerformer(e.reviewsAsEmployee)).length;

  const activeHighPerformers = await db.employee.findMany({
    where: { status: { not: "OFFBOARDED" }, ...hasUser },
    select: {
      reviewsAsEmployee: {
        where: { status: "SUBMITTED", rating: { not: null } },
        select: { rating: true },
      },
    },
  });
  const talentPool =
    activeHighPerformers.filter((e) => isHighPerformer(e.reviewsAsEmployee)).length + departedTalent;

  // Per-department turnover (based on the departed employee's department)
  const deptDepartures: Record<string, number> = {};
  for (const e of departedInPeriod) {
    const name = e.department?.name || "Unassigned";
    deptDepartures[name] = (deptDepartures[name] || 0) + 1;
  }
  const departments = await db.department.findMany({
    include: {
      employees: { where: { status: { not: "OFFBOARDED" }, ...hasUser }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  const byDepartment = departments.map((d) => {
    const active = d.employees.length;
    const left = deptDepartures[d.name] || 0;
    return {
      name: d.name,
      departures: left,
      rate: pct(left, active + left),
    };
  });

  return {
    periodLabel: "last 12 months",
    departures,
    avgHeadcount: Math.round(avgHeadcount),
    totalRate: pct(departures, avgHeadcount),
    voluntary,
    involuntary,
    unclassified,
    voluntaryRate: pct(voluntary, avgHeadcount),
    talentDepartures: departedTalent,
    talentPool,
    talentRate: pct(departedTalent, talentPool),
    byDepartment,
  };
}

// ---------------------------------------------------------------------------
// Demographics: age and seniority (gender & education aren't tracked in the HRIS)
// ---------------------------------------------------------------------------
export async function getDemographics() {
  const employees = await db.employee.findMany({
    where: { status: { not: "OFFBOARDED" }, ...hasUser },
    select: { birthday: true, startDate: true },
  });

  const now = new Date();
  const ageBuckets: Record<string, number> = {
    "<25": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "Unknown": 0,
  };
  const seniorityBuckets: Record<string, number> = {
    "<1 yr": 0, "1-2 yrs": 0, "2-5 yrs": 0, "5-10 yrs": 0, "10+ yrs": 0,
  };

  for (const e of employees) {
    if (e.birthday) {
      const age = Math.floor((now.getTime() - e.birthday.getTime()) / (DAY * 365.25));
      if (age < 25) ageBuckets["<25"]++;
      else if (age < 35) ageBuckets["25-34"]++;
      else if (age < 45) ageBuckets["35-44"]++;
      else if (age < 55) ageBuckets["45-54"]++;
      else ageBuckets["55+"]++;
    } else ageBuckets["Unknown"]++;

    const years = (now.getTime() - e.startDate.getTime()) / (DAY * 365.25);
    if (years < 1) seniorityBuckets["<1 yr"]++;
    else if (years < 2) seniorityBuckets["1-2 yrs"]++;
    else if (years < 5) seniorityBuckets["2-5 yrs"]++;
    else if (years < 10) seniorityBuckets["5-10 yrs"]++;
    else seniorityBuckets["10+ yrs"]++;
  }

  return {
    age: Object.entries(ageBuckets).map(([range, count]) => ({ range, count })),
    seniority: Object.entries(seniorityBuckets).map(([range, count]) => ({ range, count })),
    total: employees.length,
  };
}

// ---------------------------------------------------------------------------
// Retention: companywide and per manager
// ---------------------------------------------------------------------------
export async function getRetentionByManager() {
  const managers = await db.employee.findMany({
    where: { directReports: { some: { ...hasUser } }, ...hasUser },
    select: {
      firstName: true,
      lastName: true,
      status: true,
      directReports: {
        where: { ...hasUser },
        select: { status: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  return managers
    .filter((m) => m.status !== "OFFBOARDED")
    .map((m) => {
      const total = m.directReports.length;
      const active = m.directReports.filter((r) => r.status !== "OFFBOARDED").length;
      return {
        name: `${m.firstName} ${m.lastName}`,
        totalReports: total,
        activeReports: active,
        retentionRate: total > 0 ? Math.round((active / total) * 100) : 100,
      };
    })
    .sort((a, b) => a.retentionRate - b.retentionRate);
}

// ---------------------------------------------------------------------------
// Engagement & satisfaction: pulse survey mood + participation
// ---------------------------------------------------------------------------
export async function getEngagementMetrics() {
  const [surveys, activeCount] = await Promise.all([
    db.pulseSurvey.findMany({
      include: { responses: { select: { mood: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.employee.count({ where: { status: "ACTIVE", ...hasUser } }),
  ]);

  const trend = surveys
    .slice()
    .reverse()
    .map((s) => ({
      name: s.question.length > 28 ? s.question.slice(0, 28) + "…" : s.question,
      avgMood: s.responses.length
        ? Math.round((s.responses.reduce((a, r) => a + r.mood, 0) / s.responses.length) * 10) / 10
        : 0,
      responses: s.responses.length,
      participation: activeCount > 0 ? Math.round((s.responses.length / activeCount) * 100) : 0,
    }));

  const allMoods = surveys.flatMap((s) => s.responses.map((r) => r.mood));
  const avgMood = allMoods.length
    ? Math.round((allMoods.reduce((a, b) => a + b, 0) / allMoods.length) * 10) / 10
    : 0;

  // Satisfaction, eNPS-style: promoters (mood 4-5) minus detractors (mood 1-2)
  const promoters = allMoods.filter((m) => m >= 4).length;
  const detractors = allMoods.filter((m) => m <= 2).length;
  const satisfactionScore = allMoods.length
    ? Math.round(((promoters - detractors) / allMoods.length) * 100)
    : 0;

  return {
    avgMood,
    totalResponses: allMoods.length,
    promoters,
    detractors,
    promoterPct: allMoods.length ? Math.round((promoters / allMoods.length) * 100) : 0,
    detractorPct: allMoods.length ? Math.round((detractors / allMoods.length) * 100) : 0,
    satisfactionScore,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Time since last promotion (from PROMOTION feed posts; falls back to start date)
// ---------------------------------------------------------------------------
export async function getTimeSincePromotion() {
  const [employees, promoPosts] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE", ...hasUser },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, startDate: true },
    }),
    db.feedPost.findMany({
      where: { type: "PROMOTION", mentionedEmployeeId: { not: null } },
      select: { mentionedEmployeeId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lastPromo = new Map<string, Date>();
  for (const p of promoPosts) {
    if (!lastPromo.has(p.mentionedEmployeeId!)) lastPromo.set(p.mentionedEmployeeId!, p.createdAt);
  }

  const now = new Date();
  const rows = employees.map((e) => {
    const promo = lastPromo.get(e.id);
    return {
      name: `${e.firstName} ${e.lastName}`,
      jobTitle: e.jobTitle,
      everPromoted: !!promo,
      months: monthsBetween(promo ?? e.startDate, now),
    };
  });

  const promotedRows = rows.filter((r) => r.everPromoted);
  return {
    avgMonthsSincePromotion: promotedRows.length
      ? Math.round(promotedRows.reduce((s, r) => s + r.months, 0) / promotedRows.length)
      : 0,
    promotedCount: promotedRows.length,
    totalActive: rows.length,
    longestWithout: rows.sort((a, b) => b.months - a.months).slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Employee performance: self / peer / manager review ratings
// ---------------------------------------------------------------------------
export async function getPerformanceOverview() {
  const reviews = await db.review.findMany({
    where: { status: "SUBMITTED", rating: { not: null } },
    select: {
      type: true,
      rating: true,
      employee: { select: { id: true, firstName: true, lastName: true, status: true } },
    },
  });

  const byType: Record<string, number[]> = { SELF: [], MANAGER: [], PEER: [] };
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const perEmployee = new Map<string, { name: string; ratings: number[] }>();

  for (const r of reviews) {
    byType[r.type]?.push(r.rating!);
    const rounded = Math.min(5, Math.max(1, Math.round(r.rating!)));
    distribution[rounded]++;
    if (r.employee.status !== "OFFBOARDED") {
      const cur = perEmployee.get(r.employee.id) ?? {
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        ratings: [],
      };
      cur.ratings.push(r.rating!);
      perEmployee.set(r.employee.id, cur);
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const topPerformers = [...perEmployee.values()]
    .map((e) => ({ name: e.name, avgRating: avg(e.ratings), reviewCount: e.ratings.length }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  return {
    totalRated: reviews.length,
    avgByType: [
      { type: "Self", avg: avg(byType.SELF), count: byType.SELF.length },
      { type: "Manager", avg: avg(byType.MANAGER), count: byType.MANAGER.length },
      { type: "Peer", avg: avg(byType.PEER), count: byType.PEER.length },
    ],
    distribution: Object.entries(distribution).map(([rating, count]) => ({
      rating: `${rating}★`,
      count,
    })),
    topPerformers,
  };
}

// ---------------------------------------------------------------------------
// Goal tracking: goals documented in review cycles
// ---------------------------------------------------------------------------
export async function getGoalTracking() {
  const [goalReviews, activeCount] = await Promise.all([
    db.review.findMany({
      where: { status: "SUBMITTED", goals: { not: null }, employee: { status: { not: "OFFBOARDED" } } },
      select: {
        goals: true,
        updatedAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        cycle: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.employee.count({ where: { status: "ACTIVE", ...hasUser } }),
  ]);

  const withGoals = new Set(goalReviews.map((r) => r.employee.id));
  const seen = new Set<string>();
  const recent: { name: string; cycle: string; goal: string }[] = [];
  for (const r of goalReviews) {
    if (seen.has(r.employee.id) || !r.goals?.trim()) continue;
    seen.add(r.employee.id);
    recent.push({
      name: `${r.employee.firstName} ${r.employee.lastName}`,
      cycle: r.cycle.name,
      goal: r.goals.length > 140 ? r.goals.slice(0, 140) + "…" : r.goals,
    });
    if (recent.length >= 6) break;
  }

  return {
    employeesWithGoals: withGoals.size,
    totalActive: activeCount,
    coveragePct: activeCount > 0 ? Math.round((withGoals.size / activeCount) * 100) : 0,
    recent,
  };
}
