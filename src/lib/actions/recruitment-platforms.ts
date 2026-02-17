"use server";

import { db } from "@/lib/db";

export async function getRecruitmentPlatforms() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  return db.recruitmentPlatform.findMany({
    include: {
      costEntries: {
        where: {
          OR: [
            { year: { gt: twelveMonthsAgo.getFullYear() } },
            {
              year: twelveMonthsAgo.getFullYear(),
              month: { gte: twelveMonthsAgo.getMonth() + 1 },
            },
          ],
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createRecruitmentPlatform(data: {
  name: string;
  accountIdentifier?: string;
  type?: "PREMIUM" | "NICHE" | "SOCIAL" | "JOB_BOARD";
  monthlyCost?: number;
  status?: "ACTIVE" | "PAUSED" | "DISCONNECTED";
  notes?: string;
}) {
  const now = new Date();
  return db.recruitmentPlatform.create({
    data: {
      name: data.name,
      accountIdentifier: data.accountIdentifier,
      type: data.type || "JOB_BOARD",
      monthlyCost: data.monthlyCost || 0,
      status: data.status || "ACTIVE",
      notes: data.notes,
      costEntries: {
        create: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          cost: data.monthlyCost || 0,
        },
      },
    },
  });
}

export async function updateRecruitmentPlatform(
  id: string,
  data: {
    name?: string;
    accountIdentifier?: string;
    type?: "PREMIUM" | "NICHE" | "SOCIAL" | "JOB_BOARD";
    monthlyCost?: number;
    status?: "ACTIVE" | "PAUSED" | "DISCONNECTED";
    notes?: string;
  }
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const platform = await db.recruitmentPlatform.update({
    where: { id },
    data: {
      name: data.name,
      accountIdentifier: data.accountIdentifier,
      type: data.type,
      monthlyCost: data.monthlyCost,
      status: data.status,
      notes: data.notes,
    },
  });

  if (data.monthlyCost !== undefined) {
    await db.platformCostEntry.upsert({
      where: { platformId_year_month: { platformId: id, year, month } },
      create: { platformId: id, year, month, cost: data.monthlyCost },
      update: { cost: data.monthlyCost },
    });
  }

  return platform;
}

export async function deleteRecruitmentPlatform(id: string) {
  return db.recruitmentPlatform.delete({ where: { id } });
}

export async function getPlatformSpendDashboard() {
  const [platforms, candidates] = await Promise.all([
    db.recruitmentPlatform.findMany({
      include: {
        costEntries: {
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 1,
        },
      },
    }),
    db.candidate.findMany({
      where: { source: { not: null } },
      select: { source: true, status: true, costOfHire: true },
    }),
  ]);

  const sourceMap: Record<string, { total: number; hired: number; directCost: number }> = {};
  for (const c of candidates) {
    const src = c.source || "Unknown";
    if (!sourceMap[src]) sourceMap[src] = { total: 0, hired: 0, directCost: 0 };
    sourceMap[src].total++;
    if (c.status === "HIRED") sourceMap[src].hired++;
    if (c.costOfHire) sourceMap[src].directCost += c.costOfHire;
  }

  let totalMonthlySpend = 0;

  const dashboard = platforms.map((p) => {
    const sourceData = sourceMap[p.name] || { total: 0, hired: 0, directCost: 0 };
    const latestCost = p.costEntries[0]?.cost ?? p.monthlyCost;
    const activeCost = p.status === "ACTIVE" ? latestCost : 0;
    totalMonthlySpend += activeCost;

    const totalCost = sourceData.directCost + activeCost;
    const costPerHire = sourceData.hired > 0 ? Math.round(totalCost / sourceData.hired) : 0;

    let roi: "Efficient" | "Moderate" | "Expensive";
    if (costPerHire === 0 || costPerHire < 5000) roi = "Efficient";
    else if (costPerHire <= 10000) roi = "Moderate";
    else roi = "Expensive";

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      monthlyCost: latestCost,
      candidatesSourced: sourceData.total,
      hired: sourceData.hired,
      conversionRate: sourceData.total > 0 ? Math.round((sourceData.hired / sourceData.total) * 100) : 0,
      directCost: sourceData.directCost,
      totalSubscriptionCost: activeCost,
      blendedCostPerHire: costPerHire,
      roi,
    };
  });

  return { platforms: dashboard, totalMonthlySpend };
}

export async function getPlatformSpendVsHiresTrend() {
  const now = new Date();
  const months: { month: string; spend: number; hires: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const endOfMonth = new Date(year, month, 1);

    const [costEntries, hiredCount] = await Promise.all([
      db.platformCostEntry.aggregate({
        where: { year, month },
        _sum: { cost: true },
      }),
      db.candidate.count({
        where: {
          status: "HIRED",
          hiredAt: { gte: d, lt: endOfMonth },
        },
      }),
    ]);

    months.push({
      month: monthLabel,
      spend: Math.round(costEntries._sum.cost || 0),
      hires: hiredCount,
    });
  }

  return months;
}
