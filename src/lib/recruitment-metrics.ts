// Client-safe, pure recruitment-metric computation (no server/DB imports).
// The loader in src/lib/recruitment-metrics-data.ts fetches rows; everything
// here is deterministic given those rows and `now`, so it is unit-tested in
// src/lib/__tests__/recruitment-metrics.test.ts and reused by the Recruitment
// analytics page and the report export route.

import { REJECTION_REASONS, rejectionReasonLabel } from "@/lib/candidate-rejection";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Filters ────────────────────────────────────────────────────────────────

export const DATE_PRESETS = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom range" },
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number]["key"];
export const DEFAULT_PRESET: DatePreset = "90d";

export type Interval = "week" | "month";

export type MetricsFilters = {
  preset: DatePreset;
  /** Inclusive start (00:00 UTC of the first day). */
  from: Date;
  /** Inclusive end (23:59:59.999 UTC of the last day). */
  to: Date;
  positionId: string | null;
  source: string | null;
  recruiterId: string | null;
  interval: Interval;
};

export type RawFilterParams = Record<string, string | string[] | undefined>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseDay(v: string | undefined): Date | null {
  if (!v || !ISO_DAY.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  return new Date(startOfUtcDay(d).getTime() + DAY_MS - 1);
}

export function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function cleanId(v: string | undefined): string | null {
  const s = v?.trim();
  if (!s || s.length > 200) return null;
  return s;
}

/** Resolve a preset (or a custom from/to) into an inclusive UTC day range. */
export function resolveDateRange(
  preset: DatePreset,
  fromParam: string | undefined,
  toParam: string | undefined,
  now: Date,
): { preset: DatePreset; from: Date; to: Date } {
  const to = endOfUtcDay(now);
  const today = startOfUtcDay(now);
  switch (preset) {
    case "30d":
      return { preset, from: new Date(today.getTime() - 29 * DAY_MS), to };
    case "ytd":
      return { preset, from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to };
    case "12m": {
      const from = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1));
      return { preset, from, to };
    }
    case "custom": {
      let from = parseDay(fromParam);
      let end = parseDay(toParam);
      if (!from && !end) return resolveDateRange(DEFAULT_PRESET, undefined, undefined, now);
      from ??= new Date(Date.UTC(2000, 0, 1));
      end ??= today;
      if (from > end) [from, end] = [end, from];
      return { preset, from, to: endOfUtcDay(end) };
    }
    case "90d":
    default:
      return { preset: "90d", from: new Date(today.getTime() - 89 * DAY_MS), to };
  }
}

/**
 * Parse URL search params into validated filters. Unknown presets fall back to
 * the default; ids are treated as opaque strings and matched exactly in the DB.
 */
export function parseMetricsFilters(params: RawFilterParams, now: Date = new Date()): MetricsFilters {
  const rawPreset = first(params.range);
  const preset: DatePreset = DATE_PRESETS.some((p) => p.key === rawPreset) ? (rawPreset as DatePreset) : DEFAULT_PRESET;
  const range = resolveDateRange(preset, first(params.from), first(params.to), now);
  const rawInterval = first(params.interval);
  const spanDays = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  const interval: Interval =
    rawInterval === "week" || rawInterval === "month" ? rawInterval : spanDays <= 120 ? "week" : "month";
  return {
    ...range,
    positionId: cleanId(first(params.position)),
    source: cleanId(first(params.source)),
    recruiterId: cleanId(first(params.recruiter)),
    interval,
  };
}

/** Inverse of parseMetricsFilters — the query string that reproduces these filters. */
export function filtersToSearchParams(f: MetricsFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set("range", f.preset);
  if (f.preset === "custom") {
    p.set("from", toIsoDay(f.from));
    p.set("to", toIsoDay(f.to));
  }
  if (f.positionId) p.set("position", f.positionId);
  if (f.source) p.set("source", f.source);
  if (f.recruiterId) p.set("recruiter", f.recruiterId);
  p.set("interval", f.interval);
  return p;
}

// ─── Rows ───────────────────────────────────────────────────────────────────

export type CandidateMetricRow = {
  id: string;
  status: string;
  appliedAt: Date;
  hiredAt: Date | null;
  source: string | null;
  positionId: string | null;
  recruiterId: string | null;
  costOfHire: number | null;
  rejectionReason: string | null;
  rejectedAt: Date | null;
};

export type StageEventRow = {
  candidateId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
};

function inRange(d: Date | null | undefined, f: Pick<MetricsFilters, "from" | "to">): d is Date {
  return !!d && d >= f.from && d <= f.to;
}

function groupEvents(events: StageEventRow[]): Map<string, StageEventRow[]> {
  const map = new Map<string, StageEventRow[]>();
  for (const e of events) {
    const list = map.get(e.candidateId);
    if (list) list.push(e);
    else map.set(e.candidateId, [e]);
  }
  for (const list of map.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return map;
}

// ─── Stats helpers ──────────────────────────────────────────────────────────

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}

/** Percentage (0–100, one decimal) or null when the denominator is 0. */
export function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

export const FUNNEL_STEPS = [
  { key: "applied", label: "Applicants" },
  { key: "contacted", label: "Contacted" },
  { key: "interviewed", label: "Interviewed" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
] as const;

/**
 * Furthest funnel step each base status represents. Screening counts as
 * contacted; background check and pre-onboarding come after an offer;
 * onboarding/offboarding mean the person was hired. REJECTED says nothing
 * about how far they got, so it maps to null.
 */
const STATUS_STEP: Record<string, number | null> = {
  NEW: 0,
  CONTACTED: 1,
  SCREENING: 1,
  INTERVIEW: 2,
  OFFER: 3,
  BACKGROUND_CHECK: 3,
  PRE_ONBOARDING: 3,
  ONBOARDING: 4,
  OFFBOARDING: 4,
  HIRED: 4,
  REJECTED: null,
};

export function statusStep(status: string | null | undefined): number | null {
  if (!status) return null;
  return STATUS_STEP[status] ?? null;
}

/** Furthest funnel step a candidate reached, from history when available. */
export function furthestStep(c: CandidateMetricRow, events: StageEventRow[] | undefined): number {
  let best = 0;
  const consider = (s: string | null) => {
    const step = statusStep(s);
    if (step !== null && step > best) best = step;
  };
  consider(c.status);
  if (c.hiredAt) best = 4;
  for (const e of events ?? []) {
    consider(e.fromStatus);
    consider(e.toStatus);
  }
  return best;
}

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  /** % of the previous step that reached this one. */
  conversionFromPrevious: number | null;
  /** % of all applicants that reached this one. */
  conversionFromApplied: number | null;
};

export type FunnelResult = {
  steps: FunnelStep[];
  /** First CandidateStageEvent ever recorded (in the data supplied), or null. */
  trackingSince: Date | null;
  /** Cohort candidates counted from their current status only. */
  approximateCount: number;
  /** True when some of the cohort applied before stage tracking began and has no history. */
  approximate: boolean;
};

/** Candidates who applied inside the filter range. */
export function cohortOf(candidates: CandidateMetricRow[], f: Pick<MetricsFilters, "from" | "to">): CandidateMetricRow[] {
  return candidates.filter((c) => inRange(c.appliedAt, f));
}

/**
 * Cohort funnel: of the people who applied in the range, how many reached
 * each step (by now). Uses stage history where it exists; otherwise falls
 * back to the current status, which undercounts candidates who were later
 * rejected — those are flagged as approximate.
 */
export function computeFunnel(
  candidates: CandidateMetricRow[],
  events: StageEventRow[],
  f: Pick<MetricsFilters, "from" | "to">,
  trackingSince: Date | null,
): FunnelResult {
  const byCandidate = groupEvents(events);
  const cohort = cohortOf(candidates, f);
  const counts = FUNNEL_STEPS.map(() => 0);
  let approximateCount = 0;
  for (const c of cohort) {
    const evs = byCandidate.get(c.id);
    if (!evs?.length && (!trackingSince || c.appliedAt < trackingSince)) approximateCount++;
    const reached = furthestStep(c, evs);
    for (let i = 0; i <= reached; i++) counts[i]++;
  }
  const steps = FUNNEL_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i],
    conversionFromPrevious: i === 0 ? null : pct(counts[i], counts[i - 1]),
    conversionFromApplied: pct(counts[i], counts[0]),
  }));
  return { steps, trackingSince, approximateCount, approximate: approximateCount > 0 };
}

// ─── Time in stage ──────────────────────────────────────────────────────────

/** Stages shown in the time-in-stage table, in pipeline order. */
export const TIME_IN_STAGE_STATUSES = [
  "NEW",
  "CONTACTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "BACKGROUND_CHECK",
  "PRE_ONBOARDING",
  "ONBOARDING",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  BACKGROUND_CHECK: "Background check",
  PRE_ONBOARDING: "Pre-onboarding",
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export type StageStay = { status: string; start: Date; end: Date };

/**
 * Completed stays reconstructed from one candidate's ordered history. The
 * first stay starts at appliedAt only when the first recorded move left NEW
 * (we know they sat in NEW since applying); otherwise the time before the
 * first event is unknown and skipped. The current, still-open stay is not a
 * completed stay and is excluded.
 */
export function stageStays(appliedAt: Date, events: StageEventRow[]): StageStay[] {
  const stays: StageStay[] = [];
  if (events.length === 0) return stays;
  const firstEvent = events[0];
  if ((firstEvent.fromStatus === "NEW" || firstEvent.fromStatus === null) && firstEvent.createdAt >= appliedAt) {
    stays.push({ status: "NEW", start: appliedAt, end: firstEvent.createdAt });
  }
  for (let i = 0; i < events.length - 1; i++) {
    const cur = events[i];
    const next = events[i + 1];
    if (cur.toStatus === next.fromStatus || next.fromStatus === null) {
      stays.push({ status: cur.toStatus, start: cur.createdAt, end: next.createdAt });
    }
  }
  return stays;
}

export type TimeInStageRow = {
  status: string;
  label: string;
  stays: number;
  avgDays: number | null;
  medianDays: number | null;
};

/** Avg/median days per stage, over completed stays that ended within the range. */
export function computeTimeInStage(
  candidates: CandidateMetricRow[],
  events: StageEventRow[],
  f: Pick<MetricsFilters, "from" | "to">,
): TimeInStageRow[] {
  const byCandidate = groupEvents(events);
  const durations = new Map<string, number[]>();
  for (const c of candidates) {
    const evs = byCandidate.get(c.id);
    if (!evs) continue;
    for (const stay of stageStays(c.appliedAt, evs)) {
      if (!inRange(stay.end, f)) continue;
      const days = (stay.end.getTime() - stay.start.getTime()) / DAY_MS;
      const list = durations.get(stay.status);
      if (list) list.push(days);
      else durations.set(stay.status, [days]);
    }
  }
  return TIME_IN_STAGE_STATUSES.map((status) => {
    const list = durations.get(status) ?? [];
    return {
      status,
      label: STATUS_LABELS[status] ?? status,
      stays: list.length,
      avgDays: round1(mean(list)),
      medianDays: round1(median(list)),
    };
  });
}

// ─── Rejection reasons ──────────────────────────────────────────────────────

export const NOT_RECORDED = "NOT_RECORDED";

export type RejectionReasonRow = {
  code: string;
  label: string;
  count: number;
  percent: number | null;
};

/**
 * One rejection per candidate rejected in the range (their latest rejection
 * in range). Uses the stage history's reason; falls back to the candidate's
 * stored rejectionReason/rejectedAt for rejections without a history row.
 * Every standard reason is listed (zero rows included) so the table is stable.
 */
export function computeRejectionReasons(
  candidates: CandidateMetricRow[],
  events: StageEventRow[],
  f: Pick<MetricsFilters, "from" | "to">,
): { total: number; rows: RejectionReasonRow[] } {
  const latest = new Map<string, string>();
  const latestAt = new Map<string, number>();
  const ids = new Set(candidates.map((c) => c.id));
  for (const e of events) {
    if (e.toStatus !== "REJECTED" || !ids.has(e.candidateId) || !inRange(e.createdAt, f)) continue;
    const t = e.createdAt.getTime();
    if ((latestAt.get(e.candidateId) ?? -Infinity) <= t) {
      latestAt.set(e.candidateId, t);
      latest.set(e.candidateId, e.reason || NOT_RECORDED);
    }
  }
  for (const c of candidates) {
    if (latest.has(c.id)) continue;
    if (c.status === "REJECTED" && inRange(c.rejectedAt, f)) latest.set(c.id, c.rejectionReason || NOT_RECORDED);
  }
  const counts = new Map<string, number>();
  for (const code of latest.values()) counts.set(code, (counts.get(code) ?? 0) + 1);
  const total = latest.size;
  const codes: string[] = REJECTION_REASONS.map((r) => r.code);
  for (const code of counts.keys()) if (!codes.includes(code)) codes.push(code);
  const rows = codes
    .map((code) => ({
      code,
      label: code === NOT_RECORDED ? "Not recorded" : (rejectionReasonLabel(code) ?? code),
      count: counts.get(code) ?? 0,
      percent: pct(counts.get(code) ?? 0, total),
    }))
    .filter((r) => r.count > 0 || r.code !== NOT_RECORDED)
    .sort((a, b) => b.count - a.count);
  return { total, rows };
}

// ─── Time to hire ───────────────────────────────────────────────────────────

export function hiresInRange(candidates: CandidateMetricRow[], f: Pick<MetricsFilters, "from" | "to">): CandidateMetricRow[] {
  return candidates.filter((c) => inRange(c.hiredAt, f));
}

function daysToHire(c: CandidateMetricRow): number | null {
  if (!c.hiredAt) return null;
  const d = (c.hiredAt.getTime() - c.appliedAt.getTime()) / DAY_MS;
  return d >= 0 ? d : null;
}

export function computeTimeToHire(
  candidates: CandidateMetricRow[],
  f: Pick<MetricsFilters, "from" | "to">,
): { hires: number; avgDays: number | null; medianDays: number | null } {
  const days = hiresInRange(candidates, f)
    .map(daysToHire)
    .filter((d): d is number => d !== null);
  return { hires: hiresInRange(candidates, f).length, avgDays: round1(mean(days)), medianDays: round1(median(days)) };
}

// ─── Over time ──────────────────────────────────────────────────────────────

export type OverTimeRow = { periodStart: string; label: string; applicants: number; hires: number };

/** Monday (UTC) of the week containing d. */
function weekStart(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * DAY_MS);
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(start: Date, interval: Interval): string {
  const m = MONTHS[start.getUTCMonth()];
  return interval === "month"
    ? `${m} ${start.getUTCFullYear()}`
    : `${m} ${start.getUTCDate()}`;
}

/** Applicants (by appliedAt) and hires (by hiredAt) per week or month across the range. */
export function computeOverTime(
  candidates: CandidateMetricRow[],
  f: Pick<MetricsFilters, "from" | "to" | "interval">,
): OverTimeRow[] {
  const bucketOf = f.interval === "month" ? monthStart : weekStart;
  const rows = new Map<number, OverTimeRow>();
  const order: number[] = [];
  let cursor = bucketOf(f.from);
  let guard = 0;
  while (cursor <= f.to && guard++ < 1000) {
    const key = cursor.getTime();
    rows.set(key, { periodStart: toIsoDay(cursor), label: bucketLabel(cursor, f.interval), applicants: 0, hires: 0 });
    order.push(key);
    cursor =
      f.interval === "month"
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
        : new Date(cursor.getTime() + 7 * DAY_MS);
  }
  for (const c of candidates) {
    if (inRange(c.appliedAt, f)) {
      const row = rows.get(bucketOf(c.appliedAt).getTime());
      if (row) row.applicants++;
    }
    if (inRange(c.hiredAt, f)) {
      const row = rows.get(bucketOf(c.hiredAt).getTime());
      if (row) row.hires++;
    }
  }
  return order.map((k) => rows.get(k)!);
}

// ─── Source & recruiter performance ─────────────────────────────────────────

export type PerformanceRow = {
  key: string;
  name: string;
  /** Applied in the range. */
  applicants: number;
  /** Of those applicants, how many have been hired so far. */
  hiredFromApplicants: number;
  conversion: number | null;
  /** Hired in the range (regardless of when they applied). */
  hiresInPeriod: number;
  /** Direct costOfHire of hires in the period plus any platform spend. */
  spend: number | null;
  costPerHire: number | null;
  avgDaysToHire: number | null;
};

function performanceBy(
  candidates: CandidateMetricRow[],
  f: Pick<MetricsFilters, "from" | "to">,
  keyOf: (c: CandidateMetricRow) => string,
  nameOf: (key: string) => string,
  extraSpend: (key: string) => number = () => 0,
): PerformanceRow[] {
  type Acc = { applicants: number; hiredFromApplicants: number; hires: number; directCost: number; hasCost: boolean; days: number[] };
  const acc = new Map<string, Acc>();
  const get = (k: string) => {
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { applicants: 0, hiredFromApplicants: 0, hires: 0, directCost: 0, hasCost: false, days: [] }));
    return a;
  };
  for (const c of candidates) {
    const applied = inRange(c.appliedAt, f);
    const hired = inRange(c.hiredAt, f);
    if (!applied && !hired) continue;
    const a = get(keyOf(c));
    if (applied) {
      a.applicants++;
      if (c.hiredAt || statusStep(c.status) === 4) a.hiredFromApplicants++;
    }
    if (hired) {
      a.hires++;
      if (c.costOfHire !== null && c.costOfHire !== undefined) {
        a.directCost += c.costOfHire;
        a.hasCost = true;
      }
      const d = daysToHire(c);
      if (d !== null) a.days.push(d);
    }
  }
  return [...acc.entries()]
    .map(([key, a]) => {
      const platform = extraSpend(key);
      const hasSpend = a.hasCost || platform > 0;
      const spend = hasSpend ? Math.round((a.directCost + platform) * 100) / 100 : null;
      return {
        key,
        name: nameOf(key),
        applicants: a.applicants,
        hiredFromApplicants: a.hiredFromApplicants,
        conversion: pct(a.hiredFromApplicants, a.applicants),
        hiresInPeriod: a.hires,
        spend,
        costPerHire: spend !== null && a.hires > 0 ? Math.round(spend / a.hires) : null,
        avgDaysToHire: round1(mean(a.days)),
      };
    })
    .sort((x, y) => y.applicants - x.applicants || y.hiresInPeriod - x.hiresInPeriod || x.name.localeCompare(y.name));
}

export const UNKNOWN_KEY = "__unknown__";

export function computeSourcePerformance(
  candidates: CandidateMetricRow[],
  f: Pick<MetricsFilters, "from" | "to">,
  platformSpendBySource: Record<string, number> = {},
): PerformanceRow[] {
  return performanceBy(
    candidates,
    f,
    (c) => c.source?.trim() || UNKNOWN_KEY,
    (k) => (k === UNKNOWN_KEY ? "Unknown" : k),
    (k) => platformSpendBySource[k] ?? 0,
  );
}

export function computeRecruiterPerformance(
  candidates: CandidateMetricRow[],
  f: Pick<MetricsFilters, "from" | "to">,
  recruiterNames: Record<string, string>,
): PerformanceRow[] {
  return performanceBy(
    candidates,
    f,
    (c) => c.recruiterId || UNKNOWN_KEY,
    (k) => (k === UNKNOWN_KEY ? "Unassigned" : (recruiterNames[k] ?? "Unknown recruiter")),
  );
}

// ─── Platform spend ─────────────────────────────────────────────────────────

export type PlatformSpendInput = {
  name: string;
  status: string;
  monthlyCost: number;
  connectedAt: Date;
  entries: { year: number; month: number; cost: number }[];
};

/**
 * Spend per platform (keyed by platform name, which is how candidate.source
 * links to a platform) for every calendar month overlapping the range. A
 * month uses its cost entry when one exists, otherwise the platform's
 * monthly cost if it was active and connected by then.
 */
export function platformSpendInRange(
  platforms: PlatformSpendInput[],
  f: Pick<MetricsFilters, "from" | "to">,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of platforms) {
    const byMonth = new Map(p.entries.map((e) => [`${e.year}-${e.month}`, e.cost]));
    let total = 0;
    let cursor = monthStart(f.from);
    let guard = 0;
    while (cursor <= f.to && guard++ < 600) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const next = new Date(Date.UTC(y, m, 1));
      const entry = byMonth.get(`${y}-${m}`);
      if (entry !== undefined) total += entry;
      else if (p.status === "ACTIVE" && p.connectedAt < next) total += p.monthlyCost;
      cursor = next;
    }
    if (total > 0) out[p.name] = total;
  }
  return out;
}

// ─── Whole report ───────────────────────────────────────────────────────────

export type RecruitmentMetrics = {
  filters: MetricsFilters;
  summary: {
    applicants: number;
    hires: number;
    hireRate: number | null;
    rejections: number;
    avgDaysToHire: number | null;
    medianDaysToHire: number | null;
  };
  funnel: FunnelResult;
  timeInStage: TimeInStageRow[];
  rejectionReasons: { total: number; rows: RejectionReasonRow[] };
  overTime: OverTimeRow[];
  sources: PerformanceRow[];
  recruiters: PerformanceRow[];
};

export function computeRecruitmentMetrics(input: {
  filters: MetricsFilters;
  candidates: CandidateMetricRow[];
  events: StageEventRow[];
  trackingSince: Date | null;
  recruiterNames: Record<string, string>;
  platformSpendBySource?: Record<string, number>;
}): RecruitmentMetrics {
  const { filters: f, candidates, events } = input;
  const funnel = computeFunnel(candidates, events, f, input.trackingSince);
  const tth = computeTimeToHire(candidates, f);
  const rejectionReasons = computeRejectionReasons(candidates, events, f);
  const applicants = funnel.steps[0].count;
  return {
    filters: f,
    summary: {
      applicants,
      hires: tth.hires,
      hireRate: pct(funnel.steps[FUNNEL_STEPS.length - 1].count, applicants),
      rejections: rejectionReasons.total,
      avgDaysToHire: tth.avgDays,
      medianDaysToHire: tth.medianDays,
    },
    funnel,
    timeInStage: computeTimeInStage(candidates, events, f),
    rejectionReasons,
    overTime: computeOverTime(candidates, f),
    sources: computeSourcePerformance(candidates, f, input.platformSpendBySource),
    recruiters: computeRecruiterPerformance(candidates, f, input.recruiterNames),
  };
}

// ─── Report tables (export) ─────────────────────────────────────────────────

export type ReportCell = string | number | null;
export type ReportTable = { key: ReportTableKey; title: string; headers: string[]; rows: ReportCell[][] };

export const REPORT_TABLES = [
  { key: "summary", title: "Summary" },
  { key: "funnel", title: "Funnel" },
  { key: "time-in-stage", title: "Time in stage" },
  { key: "rejection-reasons", title: "Rejection reasons" },
  { key: "sources", title: "Sources" },
  { key: "recruiters", title: "Recruiters" },
  { key: "over-time", title: "Over time" },
] as const;
export type ReportTableKey = (typeof REPORT_TABLES)[number]["key"];

export function isReportTableKey(v: unknown): v is ReportTableKey {
  return typeof v === "string" && REPORT_TABLES.some((t) => t.key === v);
}

const PERF_HEADERS = [
  "Applicants",
  "Hired (of applicants)",
  "Conversion %",
  "Hires in period",
  "Spend ($)",
  "Cost per hire ($)",
  "Avg days to hire",
];

function perfRows(rows: PerformanceRow[]): ReportCell[][] {
  return rows.map((r) => [r.name, r.applicants, r.hiredFromApplicants, r.conversion, r.hiresInPeriod, r.spend, r.costPerHire, r.avgDaysToHire]);
}

/** Flatten metrics into the tables the export writes (one XLSX sheet each). */
export function buildReportTables(
  m: RecruitmentMetrics,
  labels: { position?: string | null; source?: string | null; recruiter?: string | null } = {},
): ReportTable[] {
  const f = m.filters;
  const presetLabel = DATE_PRESETS.find((p) => p.key === f.preset)?.label ?? f.preset;
  const tables: Record<ReportTableKey, Omit<ReportTable, "key" | "title">> = {
    summary: {
      headers: ["Metric", "Value"],
      rows: [
        ["Date range", `${presetLabel}: ${toIsoDay(f.from)} to ${toIsoDay(f.to)}`],
        ["Position", labels.position ?? "All positions"],
        ["Source", labels.source ?? "All sources"],
        ["Recruiter", labels.recruiter ?? "All recruiters"],
        ["Applicants", m.summary.applicants],
        ["Hires in period", m.summary.hires],
        ["Applicant-to-hire rate %", m.summary.hireRate],
        ["Rejections in period", m.summary.rejections],
        ["Avg time to hire (days)", m.summary.avgDaysToHire],
        ["Median time to hire (days)", m.summary.medianDaysToHire],
        ["Stage tracking since", m.funnel.trackingSince ? toIsoDay(m.funnel.trackingSince) : "No stage history yet"],
        ["Funnel counted from current status only (approximate)", m.funnel.approximateCount],
      ],
    },
    funnel: {
      headers: ["Stage", "Candidates", "Conversion from previous %", "Conversion from applicants %"],
      rows: m.funnel.steps.map((s) => [s.label, s.count, s.conversionFromPrevious, s.conversionFromApplied]),
    },
    "time-in-stage": {
      headers: ["Stage", "Completed stays", "Avg days", "Median days"],
      rows: m.timeInStage.map((r) => [r.label, r.stays, r.avgDays, r.medianDays]),
    },
    "rejection-reasons": {
      headers: ["Reason", "Rejections", "% of rejections"],
      rows: m.rejectionReasons.rows.map((r) => [r.label, r.count, r.percent]),
    },
    sources: { headers: ["Source", ...PERF_HEADERS], rows: perfRows(m.sources) },
    recruiters: { headers: ["Recruiter", ...PERF_HEADERS], rows: perfRows(m.recruiters) },
    "over-time": {
      headers: [f.interval === "month" ? "Month starting" : "Week starting", "Applicants", "Hires"],
      rows: m.overTime.map((r) => [r.periodStart, r.applicants, r.hires]),
    },
  };
  return REPORT_TABLES.map((t) => ({ key: t.key, title: t.title, ...tables[t.key] }));
}
