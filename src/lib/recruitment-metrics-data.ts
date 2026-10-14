import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  computeRecruitmentMetrics,
  platformSpendInRange,
  type MetricsFilters,
  type RecruitmentMetrics,
} from "@/lib/recruitment-metrics";

// Server-side loader for the Recruitment analytics tab and its export route.
// Callers must have already checked the viewer may see analytics; this
// function enforces the recruiter scope (a scoped recruiter only ever sees
// their own candidates, whatever the URL asks for).

export type FilterOption = { value: string; label: string };

export type RecruitmentFilterOptions = {
  positions: FilterOption[];
  sources: FilterOption[];
  recruiters: FilterOption[];
};

export type LoadedRecruitmentMetrics = {
  metrics: RecruitmentMetrics;
  options: RecruitmentFilterOptions;
  /** Labels for the active filters (for the report header). */
  labels: { position: string | null; source: string | null; recruiter: string | null };
  /** Set when the viewer is a scoped recruiter; the recruiter filter is locked to them. */
  scopedRecruiterId: string | null;
};

async function recruiterNameMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await db.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true },
  });
  return Object.fromEntries(rows.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
}

export async function loadRecruitmentMetrics(
  requested: MetricsFilters,
  scopedRecruiterId: string | null,
): Promise<LoadedRecruitmentMetrics> {
  const filters: MetricsFilters = scopedRecruiterId ? { ...requested, recruiterId: scopedRecruiterId } : requested;
  const range = { gte: filters.from, lte: filters.to };

  const dimension: Prisma.CandidateWhereInput = {
    ...(filters.positionId ? { positionId: filters.positionId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.recruiterId ? { recruiterId: filters.recruiterId } : {}),
  };
  const scope: Prisma.CandidateWhereInput = scopedRecruiterId ? { recruiterId: scopedRecruiterId } : {};

  const [candidates, firstEvent, positions, sourceRows, recruiterRows, settings, platforms] = await Promise.all([
    db.candidate.findMany({
      where: {
        ...dimension,
        OR: [
          { appliedAt: range },
          { hiredAt: range },
          { rejectedAt: range },
          { stageEvents: { some: { createdAt: range } } },
        ],
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        hiredAt: true,
        source: true,
        positionId: true,
        recruiterId: true,
        costOfHire: true,
        rejectionReason: true,
        rejectedAt: true,
        stageEvents: {
          select: { candidateId: true, fromStatus: true, toStatus: true, reason: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.candidateStageEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.position.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.candidate.findMany({
      where: { ...scope, source: { not: null } },
      distinct: ["source"],
      select: { source: true },
      orderBy: { source: "asc" },
    }),
    db.candidate.findMany({
      where: { ...scope, recruiterId: { not: null } },
      distinct: ["recruiterId"],
      select: { recruiterId: true },
    }),
    db.companySettings.findUnique({ where: { id: "singleton" }, select: { recruiterIds: true } }),
    db.recruitmentPlatform.findMany({
      select: {
        name: true,
        status: true,
        monthlyCost: true,
        connectedAt: true,
        costEntries: { select: { year: true, month: true, cost: true } },
      },
    }),
  ]);

  let configuredRecruiters: string[] = [];
  try {
    const parsed = JSON.parse(settings?.recruiterIds || "[]");
    if (Array.isArray(parsed)) configuredRecruiters = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    configuredRecruiters = [];
  }
  const recruiterIds = scopedRecruiterId
    ? [scopedRecruiterId]
    : [...new Set([...configuredRecruiters, ...recruiterRows.map((r) => r.recruiterId!).filter(Boolean)])];
  const names = await recruiterNameMap(recruiterIds);

  const events = candidates.flatMap((c) => c.stageEvents);
  const rows = candidates.map(({ stageEvents: _e, ...c }) => c);

  // Platform spend only makes sense per source; when filtering by one
  // recruiter or position, platform cost can't be attributed, so only the
  // candidates' direct cost of hire is used.
  const platformSpendBySource =
    filters.positionId || filters.recruiterId
      ? {}
      : platformSpendInRange(
          platforms.map((p) => ({ ...p, entries: p.costEntries })),
          filters,
        );

  const metrics = computeRecruitmentMetrics({
    filters,
    candidates: rows,
    events,
    trackingSince: firstEvent?.createdAt ?? null,
    recruiterNames: names,
    platformSpendBySource,
  });

  const options: RecruitmentFilterOptions = {
    positions: positions.map((p) => ({ value: p.id, label: p.title })),
    sources: sourceRows
      .map((s) => s.source!)
      .filter((s) => s && s.trim())
      .map((s) => ({ value: s, label: s })),
    recruiters: recruiterIds
      .map((id) => ({ value: id, label: names[id] ?? "Unknown recruiter" }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };

  return {
    metrics,
    options,
    labels: {
      position: filters.positionId ? (options.positions.find((p) => p.value === filters.positionId)?.label ?? "Unknown position") : null,
      source: filters.source,
      recruiter: filters.recruiterId ? (names[filters.recruiterId] ?? "Unknown recruiter") : null,
    },
    scopedRecruiterId,
  };
}
