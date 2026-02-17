"use server";

import { db } from "@/lib/db";

export async function getHeadcountStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const [total, active, onboarding, offboarded, newThisMonth, newThisQuarter, departedThisMonth] =
    await Promise.all([
      db.employee.count(),
      db.employee.count({ where: { status: "ACTIVE" } }),
      db.employee.count({ where: { status: "ONBOARDING" } }),
      db.employee.count({ where: { status: "OFFBOARDED" } }),
      db.employee.count({
        where: { startDate: { gte: startOfMonth }, status: { not: "OFFBOARDED" } },
      }),
      db.employee.count({
        where: { startDate: { gte: startOfQuarter }, status: { not: "OFFBOARDED" } },
      }),
      db.employee.count({
        where: { status: "OFFBOARDED", endDate: { gte: startOfMonth } },
      }),
    ]);

  return {
    total,
    active,
    onboarding,
    offboarded,
    newThisMonth,
    newThisQuarter,
    departedThisMonth,
    netGrowthMonth: newThisMonth - departedThisMonth,
  };
}

export async function getDepartmentBreakdown() {
  const departments = await db.department.findMany({
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return departments.map((d) => ({
    name: d.name,
    count: d._count.employees,
  }));
}

export async function getTenureDistribution() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { startDate: true },
  });

  const now = new Date();
  const buckets = { "<6mo": 0, "6mo-1yr": 0, "1-2yr": 0, "2-3yr": 0, "3-5yr": 0, "5+yr": 0 };

  for (const emp of employees) {
    const months = (now.getTime() - emp.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (months < 6) buckets["<6mo"]++;
    else if (months < 12) buckets["6mo-1yr"]++;
    else if (months < 24) buckets["1-2yr"]++;
    else if (months < 36) buckets["2-3yr"]++;
    else if (months < 60) buckets["3-5yr"]++;
    else buckets["5+yr"]++;
  }

  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
}

export async function getOnboardingMetrics() {
  const onboardingEmployees = await db.employee.findMany({
    where: { status: "ONBOARDING" },
    include: {
      employeeTasks: true,
    },
  });

  const metrics = onboardingEmployees.map((emp) => {
    const total = emp.employeeTasks.length;
    const done = emp.employeeTasks.filter((t) => t.status === "DONE").length;
    return {
      name: `${emp.firstName} ${emp.lastName}`,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      total,
      done,
    };
  });

  return {
    activeCount: onboardingEmployees.length,
    avgCompletion: metrics.length
      ? Math.round(metrics.reduce((acc, m) => acc + m.progress, 0) / metrics.length)
      : 0,
    employees: metrics,
  };
}

export async function getReviewMetrics() {
  const cycles = await db.reviewCycle.findMany({
    include: {
      reviews: true,
    },
    orderBy: { startDate: "desc" },
    take: 3,
  });

  return cycles.map((c) => {
    const submitted = c.reviews.filter((r) => r.status === "SUBMITTED").length;
    return {
      name: c.name,
      total: c.reviews.length,
      submitted,
      pending: c.reviews.length - submitted,
      completionRate: c.reviews.length > 0
        ? Math.round((submitted / c.reviews.length) * 100)
        : 0,
      status: c.status,
    };
  });
}

export async function getHiringPipelineStats() {
  const statuses = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const;
  const counts = await Promise.all(
    statuses.map(async (status) => ({
      status,
      count: await db.candidate.count({ where: { status } }),
    }))
  );
  return counts;
}

export async function getSourceROI() {
  const candidates = await db.candidate.findMany({
    where: { source: { not: null } },
    select: { source: true, status: true, costOfHire: true },
  });

  const sourceMap: Record<string, { total: number; hired: number; totalCost: number }> = {};
  for (const c of candidates) {
    const src = c.source || "Unknown";
    if (!sourceMap[src]) sourceMap[src] = { total: 0, hired: 0, totalCost: 0 };
    sourceMap[src].total++;
    if (c.status === "HIRED") sourceMap[src].hired++;
    if (c.costOfHire) sourceMap[src].totalCost += c.costOfHire;
  }

  return Object.entries(sourceMap).map(([source, data]) => ({
    source,
    totalCandidates: data.total,
    hired: data.hired,
    conversionRate: data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0,
    totalCost: data.totalCost,
    avgCostPerHire: data.hired > 0 ? Math.round(data.totalCost / data.hired) : 0,
  }));
}

export async function getTimeToHire() {
  const hired = await db.candidate.findMany({
    where: { status: "HIRED", hiredAt: { not: null } },
    select: { appliedAt: true, hiredAt: true, position: { select: { title: true } } },
  });

  const times = hired.map((c) => {
    const days = Math.round(
      (c.hiredAt!.getTime() - c.appliedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { position: c.position?.title || "Unknown", days };
  });

  const avgDays = times.length
    ? Math.round(times.reduce((acc, t) => acc + t.days, 0) / times.length)
    : 0;

  return { avgDays, hires: times };
}

export async function getRetentionRate() {
  const totalEver = await db.employee.count();
  const departed = await db.employee.count({ where: { status: "OFFBOARDED" } });
  const current = totalEver - departed;

  return {
    retentionRate: totalEver > 0 ? Math.round((current / totalEver) * 100) : 100,
    totalEmployees: totalEver,
    currentEmployees: current,
    departed,
  };
}

export async function getTurnoverByMonth() {
  const now = new Date();
  const months: { month: string; departures: number; hires: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthName = start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const [departures, hires] = await Promise.all([
      db.employee.count({
        where: { status: "OFFBOARDED", endDate: { gte: start, lt: end } },
      }),
      db.employee.count({
        where: { startDate: { gte: start, lt: end } },
      }),
    ]);

    months.push({ month: monthName, departures, hires });
  }

  return months;
}

export async function getUpcomingBirthdays() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", birthday: { not: null } },
    select: { id: true, firstName: true, lastName: true, birthday: true, department: { select: { name: true } } },
  });

  const now = new Date();
  const thisMonth = now.getMonth();
  const nextMonth = (thisMonth + 1) % 12;

  return employees
    .filter((e) => {
      const m = e.birthday!.getMonth();
      return m === thisMonth || m === nextMonth;
    })
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      birthday: e.birthday!,
      department: e.department?.name || "",
      daysUntil: (() => {
        const bd = new Date(now.getFullYear(), e.birthday!.getMonth(), e.birthday!.getDate());
        if (bd < now) bd.setFullYear(bd.getFullYear() + 1);
        return Math.ceil((bd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      })(),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getUpcomingAnniversaries() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", anniversaryDate: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      anniversaryDate: true,
      startDate: true,
      department: { select: { name: true } },
    },
  });

  const now = new Date();
  const thisMonth = now.getMonth();
  const nextMonth = (thisMonth + 1) % 12;

  return employees
    .filter((e) => {
      const m = e.anniversaryDate!.getMonth();
      return m === thisMonth || m === nextMonth;
    })
    .map((e) => {
      const years = now.getFullYear() - e.startDate.getFullYear();
      return {
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        anniversaryDate: e.anniversaryDate!,
        years,
        department: e.department?.name || "",
      };
    })
    .sort((a, b) => a.anniversaryDate.getTime() - b.anniversaryDate.getTime());
}

export async function getDietaryRestrictions() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", dietaryRestrictions: { not: null } },
    select: { firstName: true, lastName: true, dietaryRestrictions: true },
  });

  const counts: Record<string, number> = {};
  for (const e of employees) {
    const restriction = e.dietaryRestrictions || "None";
    counts[restriction] = (counts[restriction] || 0) + 1;
  }

  return {
    summary: Object.entries(counts).map(([type, count]) => ({ type, count })),
    employees: employees.map((e) => ({
      name: `${e.firstName} ${e.lastName}`,
      restriction: e.dietaryRestrictions!,
    })),
  };
}

export async function getRecruiterAnalytics() {
  const candidates = await db.candidate.findMany({
    where: { recruiterId: { not: null } },
    select: { recruiterId: true, status: true, costOfHire: true, appliedAt: true, hiredAt: true },
  });

  // Group by recruiter (for now we just track by recruiterId)
  const recruiterMap: Record<string, {
    total: number;
    hired: number;
    totalCost: number;
    avgTimeToHire: number[];
  }> = {};

  for (const c of candidates) {
    const rid = c.recruiterId!;
    if (!recruiterMap[rid])
      recruiterMap[rid] = { total: 0, hired: 0, totalCost: 0, avgTimeToHire: [] };
    recruiterMap[rid].total++;
    if (c.status === "HIRED") {
      recruiterMap[rid].hired++;
      if (c.hiredAt) {
        const days = Math.round(
          (c.hiredAt.getTime() - c.appliedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        recruiterMap[rid].avgTimeToHire.push(days);
      }
    }
    if (c.costOfHire) recruiterMap[rid].totalCost += c.costOfHire;
  }

  // Resolve recruiter names
  const recruiterIds = Object.keys(recruiterMap);
  const employees = await db.employee.findMany({
    where: { id: { in: recruiterIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  const nameMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return Object.entries(recruiterMap).map(([id, data]) => ({
    name: nameMap.get(id) || "Unknown",
    totalCandidates: data.total,
    hired: data.hired,
    conversionRate: data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0,
    totalCost: data.totalCost,
    avgTimeToHire: data.avgTimeToHire.length
      ? Math.round(data.avgTimeToHire.reduce((a, b) => a + b, 0) / data.avgTimeToHire.length)
      : 0,
  }));
}

export async function getBlendedCostPerHire() {
  const [candidates, activePlatforms] = await Promise.all([
    db.candidate.findMany({
      where: { status: "HIRED" },
      select: { costOfHire: true },
    }),
    db.recruitmentPlatform.findMany({
      where: { status: "ACTIVE" },
      select: { monthlyCost: true },
    }),
  ]);

  const totalHires = candidates.length;
  const totalDirectCost = candidates.reduce((sum, c) => sum + (c.costOfHire || 0), 0);
  const totalPlatformCost = activePlatforms.reduce((sum, p) => sum + p.monthlyCost, 0);

  return {
    totalHires,
    directCostPerHire: totalHires > 0 ? Math.round(totalDirectCost / totalHires) : 0,
    platformCostPerHire: totalHires > 0 ? Math.round(totalPlatformCost / totalHires) : 0,
    blendedCostPerHire: totalHires > 0 ? Math.round((totalDirectCost + totalPlatformCost) / totalHires) : 0,
  };
}

export async function getBenefitsEligibility() {
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      benefitsEligibleDate: true,
      startDate: true,
      department: { select: { name: true } },
    },
  });

  const now = new Date();
  const eligible = employees.filter(
    (e) => e.benefitsEligibleDate && e.benefitsEligibleDate <= now
  );
  const upcoming = employees
    .filter((e) => e.benefitsEligibleDate && e.benefitsEligibleDate > now)
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      department: e.department?.name || "",
      eligibleDate: e.benefitsEligibleDate!,
      daysUntil: Math.ceil(
        (e.benefitsEligibleDate!.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    totalEligible: eligible.length,
    totalActive: employees.length,
    eligibilityRate:
      employees.length > 0
        ? Math.round((eligible.length / employees.length) * 100)
        : 0,
    upcoming,
  };
}
