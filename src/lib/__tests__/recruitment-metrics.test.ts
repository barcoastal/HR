import { describe, expect, it } from "vitest";
import {
  buildReportTables,
  computeFunnel,
  computeOverTime,
  computeRecruiterPerformance,
  computeRecruitmentMetrics,
  computeRejectionReasons,
  computeSourcePerformance,
  computeTimeInStage,
  computeTimeToHire,
  filtersToSearchParams,
  median,
  parseMetricsFilters,
  platformSpendInRange,
  resolveDateRange,
  stageStays,
  type CandidateMetricRow,
  type MetricsFilters,
  type StageEventRow,
} from "@/lib/recruitment-metrics";

const NOW = new Date("2026-10-14T15:00:00.000Z");
const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

function cand(id: string, over: Partial<CandidateMetricRow> = {}): CandidateMetricRow {
  return {
    id,
    status: "NEW",
    appliedAt: d("2026-09-01"),
    hiredAt: null,
    source: "Indeed",
    positionId: "pos-1",
    recruiterId: "rec-1",
    costOfHire: null,
    rejectionReason: null,
    rejectedAt: null,
    ...over,
  };
}

function ev(candidateId: string, fromStatus: string | null, toStatus: string, at: string, reason: string | null = null): StageEventRow {
  return { candidateId, fromStatus, toStatus, reason, createdAt: d(at) };
}

const RANGE: MetricsFilters = {
  preset: "custom",
  from: new Date("2026-08-01T00:00:00.000Z"),
  to: new Date("2026-10-14T23:59:59.999Z"),
  positionId: null,
  source: null,
  recruiterId: null,
  interval: "month",
};

describe("date ranges and filter parsing", () => {
  it("resolves presets to inclusive UTC day ranges", () => {
    const r30 = resolveDateRange("30d", undefined, undefined, NOW);
    expect(r30.from.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(r30.to.toISOString()).toBe("2026-10-14T23:59:59.999Z");
    expect(resolveDateRange("90d", undefined, undefined, NOW).from.toISOString()).toBe("2026-07-17T00:00:00.000Z");
    expect(resolveDateRange("ytd", undefined, undefined, NOW).from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(resolveDateRange("12m", undefined, undefined, NOW).from.toISOString()).toBe("2025-10-15T00:00:00.000Z");
  });

  it("parses custom ranges, swapping reversed dates and ignoring junk", () => {
    const r = resolveDateRange("custom", "2026-06-30", "2026-06-01", NOW);
    expect(r.from.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-06-30T23:59:59.999Z");
    expect(resolveDateRange("custom", "nope", "", NOW).preset).toBe("90d");
  });

  it("parses search params, defaults the preset and picks an interval from the span", () => {
    const f = parseMetricsFilters({ range: "bogus", source: " LinkedIn ", recruiter: "", position: ["p1", "p2"] }, NOW);
    expect(f.preset).toBe("90d");
    expect(f.source).toBe("LinkedIn");
    expect(f.recruiterId).toBeNull();
    expect(f.positionId).toBe("p1");
    expect(f.interval).toBe("week");
    expect(parseMetricsFilters({ range: "12m" }, NOW).interval).toBe("month");
    expect(parseMetricsFilters({ range: "12m", interval: "week" }, NOW).interval).toBe("week");
  });

  it("round-trips filters through search params", () => {
    const f = parseMetricsFilters({ range: "custom", from: "2026-01-01", to: "2026-03-31", source: "Indeed" }, NOW);
    const again = parseMetricsFilters(Object.fromEntries(filtersToSearchParams(f)), NOW);
    expect(again).toEqual(f);
  });
});

describe("funnel", () => {
  it("counts the furthest step reached using stage history, including rejected candidates", () => {
    const candidates = [
      cand("a", { status: "HIRED", hiredAt: d("2026-09-20") }),
      cand("b", { status: "REJECTED" }),
      cand("c", { status: "CONTACTED" }),
      cand("d", { status: "NEW" }),
      cand("old", { appliedAt: d("2026-01-01"), status: "HIRED" }), // outside cohort
    ];
    const events = [
      ev("b", "NEW", "CONTACTED", "2026-09-02"),
      ev("b", "CONTACTED", "INTERVIEW", "2026-09-05"),
      ev("b", "INTERVIEW", "REJECTED", "2026-09-08", "FAILED_INTERVIEW"),
    ];
    const f = computeFunnel(candidates, events, RANGE, d("2026-08-15"));
    expect(f.steps.map((s) => s.count)).toEqual([4, 3, 2, 1, 1]);
    expect(f.steps[1].conversionFromPrevious).toBe(75);
    expect(f.steps[2].conversionFromPrevious).toBe(66.7);
    expect(f.steps[4].conversionFromApplied).toBe(25);
    expect(f.approximate).toBe(false);
  });

  it("flags candidates without history who applied before tracking began", () => {
    const candidates = [cand("x", { appliedAt: d("2026-08-02"), status: "REJECTED" }), cand("y", { appliedAt: d("2026-09-10") })];
    const f = computeFunnel(candidates, [], RANGE, d("2026-09-01"));
    expect(f.approximateCount).toBe(1);
    expect(f.approximate).toBe(true);
    expect(f.steps[0].count).toBe(2);
    expect(f.steps[1].count).toBe(0);
    expect(computeFunnel(candidates, [], RANGE, null).approximateCount).toBe(2);
  });

  it("treats onboarding statuses and hiredAt as hired", () => {
    const f = computeFunnel([cand("o", { status: "ONBOARDING" }), cand("h", { status: "NEW", hiredAt: d("2026-09-09") })], [], RANGE, null);
    expect(f.steps[4].count).toBe(2);
  });
});

describe("time in stage", () => {
  it("reconstructs completed stays, starting NEW at appliedAt", () => {
    const stays = stageStays(d("2026-09-01"), [
      ev("a", "NEW", "CONTACTED", "2026-09-03"),
      ev("a", "CONTACTED", "INTERVIEW", "2026-09-08"),
      ev("a", "INTERVIEW", "OFFER", "2026-09-10"),
    ]);
    expect(stays.map((s) => s.status)).toEqual(["NEW", "CONTACTED", "INTERVIEW"]);
  });

  it("skips the unknown stay before the first event when it did not leave NEW", () => {
    const stays = stageStays(d("2026-01-01"), [ev("a", "INTERVIEW", "OFFER", "2026-09-03"), ev("a", "OFFER", "HIRED", "2026-09-05")]);
    expect(stays).toEqual([{ status: "OFFER", start: d("2026-09-03"), end: d("2026-09-05") }]);
  });

  it("averages and medians stays that ended in range", () => {
    const candidates = [cand("a"), cand("b"), cand("c")];
    const events = [
      ev("a", "NEW", "CONTACTED", "2026-09-02"), // NEW 1 day
      ev("b", "NEW", "CONTACTED", "2026-09-04"), // NEW 3 days
      ev("c", "NEW", "CONTACTED", "2026-09-09"), // NEW 8 days
      ev("a", "CONTACTED", "INTERVIEW", "2026-09-12"), // CONTACTED 10 days
    ];
    const rows = computeTimeInStage(candidates, events, RANGE);
    const neu = rows.find((r) => r.status === "NEW")!;
    expect(neu.stays).toBe(3);
    expect(neu.avgDays).toBe(4);
    expect(neu.medianDays).toBe(3);
    expect(rows.find((r) => r.status === "CONTACTED")!.avgDays).toBe(10);
    expect(rows.find((r) => r.status === "OFFER")!.avgDays).toBeNull();
  });
});

describe("rejection reasons", () => {
  it("counts the latest rejection per candidate in range, falling back to stored fields", () => {
    const candidates = [
      cand("a", { status: "REJECTED" }),
      cand("b", { status: "REJECTED", rejectionReason: "NO_LINKEDIN_PROFILE", rejectedAt: d("2026-09-20") }),
      cand("c", { status: "REJECTED", rejectionReason: "NO_SHOW", rejectedAt: d("2025-01-01") }), // out of range
      cand("e", { status: "REJECTED" }),
    ];
    const events = [
      ev("a", "NEW", "REJECTED", "2026-09-02", "NOT_QUALIFIED"),
      ev("a", "REJECTED", "NEW", "2026-09-03"),
      ev("a", "NEW", "REJECTED", "2026-09-04", "NO_LINKEDIN_PROFILE"),
      ev("e", "NEW", "REJECTED", "2026-09-05", null),
    ];
    const r = computeRejectionReasons(candidates, events, RANGE);
    expect(r.total).toBe(3);
    const linkedin = r.rows.find((x) => x.code === "NO_LINKEDIN_PROFILE")!;
    expect(linkedin.label).toBe("No LinkedIn profile");
    expect(linkedin.count).toBe(2);
    expect(linkedin.percent).toBe(66.7);
    expect(r.rows.find((x) => x.code === "NOT_RECORDED")!.count).toBe(1);
    expect(r.rows.find((x) => x.code === "NOT_QUALIFIED")!.count).toBe(0);
    expect(r.rows[0].code).toBe("NO_LINKEDIN_PROFILE");
  });
});

describe("time to hire and over time", () => {
  it("computes avg and median days to hire for hires in range", () => {
    const candidates = [
      cand("a", { appliedAt: d("2026-09-01"), hiredAt: d("2026-09-11"), status: "HIRED" }),
      cand("b", { appliedAt: d("2026-07-01"), hiredAt: d("2026-09-01"), status: "HIRED" }),
      cand("c", { appliedAt: d("2026-09-01"), hiredAt: d("2026-09-21"), status: "HIRED" }),
      cand("old", { appliedAt: d("2025-01-01"), hiredAt: d("2025-02-01"), status: "HIRED" }),
    ];
    const t = computeTimeToHire(candidates, RANGE);
    expect(t.hires).toBe(3);
    expect(t.medianDays).toBe(20);
    expect(t.avgDays).toBe(30.7);
    expect(median([])).toBeNull();
  });

  it("buckets applicants and hires by month and by Monday-start week", () => {
    const candidates = [
      cand("a", { appliedAt: d("2026-08-03"), hiredAt: d("2026-09-15") }),
      cand("b", { appliedAt: d("2026-08-20") }),
      cand("c", { appliedAt: d("2026-10-01") }),
    ];
    const months = computeOverTime(candidates, RANGE);
    expect(months.map((m) => [m.periodStart, m.applicants, m.hires])).toEqual([
      ["2026-08-01", 2, 0],
      ["2026-09-01", 0, 1],
      ["2026-10-01", 1, 0],
    ]);
    const weeks = computeOverTime(candidates, { ...RANGE, from: new Date("2026-08-01T00:00:00Z"), to: new Date("2026-08-31T23:59:59Z"), interval: "week" });
    expect(weeks[0].periodStart).toBe("2026-07-27");
    expect(weeks.find((w) => w.periodStart === "2026-08-03")!.applicants).toBe(1);
    expect(weeks.find((w) => w.periodStart === "2026-08-17")!.applicants).toBe(1);
  });
});

describe("source and recruiter performance", () => {
  const candidates = [
    cand("a", { source: "LinkedIn", status: "HIRED", hiredAt: d("2026-09-15"), costOfHire: 500, recruiterId: "r1" }),
    cand("b", { source: "LinkedIn", recruiterId: "r1" }),
    cand("c", { source: "Indeed", recruiterId: "r2" }),
    cand("d", { source: null, recruiterId: null }),
    cand("prior", { source: "Indeed", appliedAt: d("2026-05-01"), hiredAt: d("2026-08-10"), status: "HIRED", recruiterId: "r2" }),
  ];

  it("reports applicants, conversion, hires, spend and cost per hire by source", () => {
    const rows = computeSourcePerformance(candidates, RANGE, { Indeed: 900 });
    const li = rows.find((r) => r.name === "LinkedIn")!;
    expect(li).toMatchObject({ applicants: 2, hiredFromApplicants: 1, conversion: 50, hiresInPeriod: 1, spend: 500, costPerHire: 500 });
    const indeed = rows.find((r) => r.name === "Indeed")!;
    expect(indeed).toMatchObject({ applicants: 1, hiredFromApplicants: 0, hiresInPeriod: 1, spend: 900, costPerHire: 900 });
    expect(rows.find((r) => r.name === "Unknown")!.spend).toBeNull();
  });

  it("names recruiters and groups unassigned candidates", () => {
    const rows = computeRecruiterPerformance(candidates, RANGE, { r1: "Pat Example" });
    expect(rows.find((r) => r.key === "r1")!.name).toBe("Pat Example");
    expect(rows.find((r) => r.key === "r2")!.name).toBe("Unknown recruiter");
    expect(rows.find((r) => r.name === "Unassigned")!.applicants).toBe(1);
  });

  it("sums platform spend per month from entries, else monthly cost while active", () => {
    const spend = platformSpendInRange(
      [
        { name: "Indeed", status: "ACTIVE", monthlyCost: 100, connectedAt: d("2026-01-01"), entries: [{ year: 2026, month: 9, cost: 250 }] },
        { name: "Paused", status: "PAUSED", monthlyCost: 100, connectedAt: d("2026-01-01"), entries: [] },
        { name: "New", status: "ACTIVE", monthlyCost: 40, connectedAt: d("2026-10-05"), entries: [] },
      ],
      RANGE,
    );
    expect(spend).toEqual({ Indeed: 100 + 250 + 100, New: 40 });
  });
});

describe("report tables", () => {
  it("builds one table per sheet with stable headers", () => {
    const m = computeRecruitmentMetrics({
      filters: RANGE,
      candidates: [cand("a", { status: "HIRED", hiredAt: d("2026-09-15") }), cand("b")],
      events: [ev("a", "NEW", "HIRED", "2026-09-15")],
      trackingSince: d("2026-08-15"),
      recruiterNames: { "rec-1": "Pat Example" },
    });
    expect(m.summary.applicants).toBe(2);
    expect(m.summary.hireRate).toBe(50);
    const tables = buildReportTables(m, { source: "Indeed" });
    expect(tables.map((t) => t.title)).toEqual(["Summary", "Funnel", "Time in stage", "Rejection reasons", "Sources", "Recruiters", "Over time"]);
    for (const t of tables) for (const row of t.rows) expect(row.length).toBe(t.headers.length);
    expect(tables[0].rows).toContainEqual(["Source", "Indeed"]);
    expect(tables[0].rows).toContainEqual(["Stage tracking since", "2026-08-15"]);
    expect(tables[5].rows[0][0]).toBe("Pat Example");
  });
});
