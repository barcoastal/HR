import { describe, expect, it } from "vitest";
import {
  countByColor,
  daysUntil,
  describeDaysUntil,
  isPastClass,
  isValidDateKey,
  remainingToTarget,
  rosterToCsv,
  sortMembers,
  splitAndSortClasses,
  stageLabelFor,
} from "@/lib/recruitment-classes/logic";

describe("countByColor", () => {
  it("counts each color and the total", () => {
    const counts = countByColor([{ color: "GREEN" }, { color: "GREEN" }, { color: "YELLOW" }, { color: "RED" }]);
    expect(counts).toEqual({ GREEN: 2, YELLOW: 1, RED: 1, total: 4 });
  });

  it("returns zeros for an empty class", () => {
    expect(countByColor([])).toEqual({ GREEN: 0, YELLOW: 0, RED: 0, total: 0 });
  });
});

describe("daysUntil", () => {
  it("counts whole calendar days, across month and DST boundaries", () => {
    expect(daysUntil("2026-10-12", "2026-10-12")).toBe(0);
    expect(daysUntil("2026-10-12", "2026-10-11")).toBe(1);
    expect(daysUntil("2026-11-02", "2026-10-31")).toBe(2);
    expect(daysUntil("2026-10-01", "2026-10-12")).toBe(-11);
  });

  it("returns NaN for malformed or impossible dates", () => {
    expect(daysUntil("2026-02-30", "2026-02-01")).toBeNaN();
    expect(daysUntil("Oct 12", "2026-02-01")).toBeNaN();
    expect(isValidDateKey("2026-10-12")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
  });
});

describe("describeDaysUntil", () => {
  it("phrases the countdown for people", () => {
    expect(describeDaysUntil(0)).toBe("Starts today");
    expect(describeDaysUntil(1)).toBe("Starts tomorrow");
    expect(describeDaysUntil(5)).toBe("In 5 days");
    expect(describeDaysUntil(-1)).toBe("Started yesterday");
    expect(describeDaysUntil(-3)).toBe("Started 3 days ago");
  });
});

describe("isPastClass / splitAndSortClasses", () => {
  const today = "2026-10-14";

  it("keeps a class starting today current, and treats started or cancelled classes as past", () => {
    expect(isPastClass({ startDate: today, status: "UPCOMING" }, today)).toBe(false);
    expect(isPastClass({ startDate: "2026-10-13", status: "UPCOMING" }, today)).toBe(true);
    expect(isPastClass({ startDate: "2026-12-01", status: "CANCELLED" }, today)).toBe(true);
    expect(isPastClass({ startDate: "2026-12-01", status: "STARTED" }, today)).toBe(true);
  });

  it("sorts upcoming soonest first and past most recent first", () => {
    const { upcoming, past } = splitAndSortClasses(
      [
        { name: "Closers", startDate: "2026-11-02", status: "UPCOMING" as const },
        { name: "Openers", startDate: "2026-10-19", status: "UPCOMING" as const },
        { name: "Alpha", startDate: "2026-10-19", status: "UPCOMING" as const },
        { name: "Old", startDate: "2026-09-01", status: "UPCOMING" as const },
        { name: "Recent", startDate: "2026-10-12", status: "STARTED" as const },
      ],
      today,
    );
    expect(upcoming.map((c) => c.name)).toEqual(["Alpha", "Openers", "Closers"]);
    expect(past.map((c) => c.name)).toEqual(["Recent", "Old"]);
  });
});

describe("sortMembers", () => {
  it("lists Green, then Yellow, then Red, alphabetically within each", () => {
    const sorted = sortMembers([
      { name: "Zed", color: "RED" as const },
      { name: "Bea", color: "YELLOW" as const },
      { name: "Al", color: "YELLOW" as const },
      { name: "Cy", color: "GREEN" as const },
    ]);
    expect(sorted.map((m) => m.name)).toEqual(["Cy", "Al", "Bea", "Zed"]);
  });
});

describe("remainingToTarget", () => {
  it("counts only Green toward the target and never goes negative", () => {
    const counts = countByColor([{ color: "GREEN" }, { color: "YELLOW" }]);
    expect(remainingToTarget(counts, 3)).toBe(2);
    expect(remainingToTarget(counts, 1)).toBe(0);
    expect(remainingToTarget(counts, null)).toBeNull();
  });
});

describe("rosterToCsv", () => {
  it("writes a header, quotes commas, and neutralises formulas while keeping phone numbers", () => {
    const csv = rosterToCsv([
      { name: "Test, Person", color: "GREEN", stage: "Offer", email: "t@example.com", phone: "+1 555 0100", recruiter: null, note: "=HYPERLINK(1)" },
    ]);
    const [header, row] = csv.split("\n");
    expect(header).toBe("Name,Color,Meaning,Stage,Email,Phone,Recruiter,Note");
    expect(row).toBe(`"Test, Person",Green,Cleared and ready to start,Offer,t@example.com,+1 555 0100,,'=HYPERLINK(1)`);
  });
});

describe("stageLabelFor", () => {
  const stages = [
    { id: "screening", label: "Screening", enumValue: "SCREENING" },
    { id: "phone_screen", label: "Phone screen", enumValue: "SCREENING" },
  ];
  const legacy = { SCREENING: "screening" };

  it("prefers the explicit custom stage, then the legacy stage, then a status fallback", () => {
    expect(stageLabelFor({ status: "SCREENING", stageId: "phone_screen" }, stages, legacy)).toBe("Phone screen");
    expect(stageLabelFor({ status: "SCREENING", stageId: null }, stages, legacy)).toBe("Screening");
    expect(stageLabelFor({ status: "PRE_ONBOARDING" }, stages, legacy)).toBe("Written Offer");
  });
});
