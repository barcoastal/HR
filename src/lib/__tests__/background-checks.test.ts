import { describe, expect, it } from "vitest";
import {
  deriveBackgroundCheckStatus,
  isOpenBackgroundCheck,
  summarizeBackgroundChecks,
} from "@/lib/background-checks/status";

describe("deriveBackgroundCheckStatus", () => {
  it("treats a missing status as not started", () => {
    expect(deriveBackgroundCheckStatus(null)).toBe("NOT_STARTED");
    expect(deriveBackgroundCheckStatus(undefined)).toBe("NOT_STARTED");
    expect(deriveBackgroundCheckStatus("   ")).toBe("NOT_STARTED");
  });

  it("passes known statuses through, case-insensitively", () => {
    expect(deriveBackgroundCheckStatus("AWAITING_APPLICANT")).toBe("AWAITING_APPLICANT");
    expect(deriveBackgroundCheckStatus("pending")).toBe("PENDING");
    expect(deriveBackgroundCheckStatus("Passed")).toBe("PASSED");
    expect(deriveBackgroundCheckStatus("FAILED")).toBe("FAILED");
    expect(deriveBackgroundCheckStatus("ERROR")).toBe("ERROR");
  });

  it("surfaces unknown values as ERROR instead of hiding them", () => {
    expect(deriveBackgroundCheckStatus("COMPLETE")).toBe("ERROR");
  });
});

describe("isOpenBackgroundCheck", () => {
  it("is true only while the check is still in flight", () => {
    expect(isOpenBackgroundCheck("AWAITING_APPLICANT")).toBe(true);
    expect(isOpenBackgroundCheck("PENDING")).toBe(true);
    expect(isOpenBackgroundCheck("PASSED")).toBe(false);
    expect(isOpenBackgroundCheck("FAILED")).toBe(false);
    expect(isOpenBackgroundCheck("ERROR")).toBe(false);
    expect(isOpenBackgroundCheck("NOT_STARTED")).toBe(false);
  });
});

describe("summarizeBackgroundChecks", () => {
  it("counts every status and the total", () => {
    expect(summarizeBackgroundChecks(["PENDING", "PASSED", "PENDING", "FAILED", "AWAITING_APPLICANT"])).toEqual({
      NOT_STARTED: 0,
      AWAITING_APPLICANT: 1,
      PENDING: 2,
      PASSED: 1,
      FAILED: 1,
      ERROR: 0,
      total: 5,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(summarizeBackgroundChecks([]).total).toBe(0);
  });
});
