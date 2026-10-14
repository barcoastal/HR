import { describe, expect, it } from "vitest";
import {
  addMonthsToKey,
  canScheduleEmployeeMilestones,
  canSeeEmployeeMilestones,
  computeEmployeeMilestones,
  milestoneKey,
  parseMilestoneKey,
  resolveMilestones,
  selectDueReminders,
  type MilestoneMeeting,
} from "@/lib/review-milestones";

const startDate = new Date("2026-01-15T00:00:00.000Z"); // date-only column (UTC midnight)
const emp = { id: "emp-1", startDate };

describe("computeEmployeeMilestones", () => {
  it("computes 30/60/90-day, quarterly and yearly reviews from the start date", () => {
    const list = computeEmployeeMilestones(emp, "2026-01-01", "2028-01-31");
    expect(list.map((m) => `${m.kind}@${m.dueKey}`)).toEqual([
      "THIRTY_DAY@2026-02-14",
      "SIXTY_DAY@2026-03-16",
      "NINETY_DAY@2026-04-15",
      "QUARTERLY@2026-07-15",
      "QUARTERLY@2026-10-15",
      "YEARLY@2027-01-15",
      "QUARTERLY@2027-04-15",
      "QUARTERLY@2027-07-15",
      "QUARTERLY@2027-10-15",
      "YEARLY@2028-01-15",
    ]);
    expect(list[0].key).toBe("emp-1:THIRTY_DAY:2026-02-14");
  });

  it("only returns milestones inside the range", () => {
    const list = computeEmployeeMilestones(emp, "2026-03-01", "2026-04-30");
    expect(list.map((m) => m.kind)).toEqual(["SIXTY_DAY", "NINETY_DAY"]);
  });

  it("uses the anniversary date for quarterly and yearly reviews when set", () => {
    const list = computeEmployeeMilestones(
      { id: "e", startDate: new Date("2026-01-15T00:00:00Z"), anniversaryDate: new Date("2026-02-01T00:00:00Z") },
      "2026-05-01",
      "2027-02-28"
    );
    expect(list.map((m) => `${m.kind}@${m.dueKey}`)).toEqual([
      "QUARTERLY@2026-08-01",
      "QUARTERLY@2026-11-01",
      "YEARLY@2027-02-01",
    ]);
  });

  it("clamps month arithmetic to the end of short months", () => {
    expect(addMonthsToKey("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsToKey("2027-11-30", 3)).toBe("2028-02-29");
  });

  it("round-trips milestone keys", () => {
    const key = milestoneKey("a:b-uuid", "SIXTY_DAY", "2026-03-16");
    expect(parseMilestoneKey(key)).toEqual({ employeeId: "a:b-uuid", kind: "SIXTY_DAY", dueKey: "2026-03-16" });
    expect(parseMilestoneKey("garbage")).toBeNull();
  });
});

describe("resolveMilestones", () => {
  const milestones = computeEmployeeMilestones(emp, "2026-01-01", "2026-05-01"); // 30, 60, 90
  const meeting = (over: Partial<MilestoneMeeting>): MilestoneMeeting => ({
    id: "m", employeeId: "emp-1", type: "THIRTY_DAY", status: "SCHEDULED", dayKey: "2026-02-14", milestoneKey: null, ...over,
  });

  it("links meetings by milestoneKey first", () => {
    const resolved = resolveMilestones(milestones, [
      meeting({ id: "linked", type: "SIXTY_DAY", dayKey: "2026-03-20", milestoneKey: "emp-1:SIXTY_DAY:2026-03-16" }),
    ], "2026-01-20");
    expect(resolved.find((m) => m.kind === "SIXTY_DAY")).toMatchObject({ status: "scheduled", meetingId: "linked", meetingKey: "2026-03-20" });
    expect(resolved.find((m) => m.kind === "THIRTY_DAY")?.status).toBe("due");
  });

  it("counts an unlinked compatible meeting near the due date, once", () => {
    const resolved = resolveMilestones(milestones, [
      meeting({ id: "auto90", type: "QUARTERLY", dayKey: "2026-04-10", status: "COMPLETED" }),
    ], "2026-04-20");
    expect(resolved.find((m) => m.kind === "NINETY_DAY")).toMatchObject({ status: "completed", meetingId: "auto90" });
    expect(resolved.find((m) => m.kind === "SIXTY_DAY")?.status).toBe("overdue");
  });

  it("ignores cancelled, far-away and other employees' meetings", () => {
    const resolved = resolveMilestones(milestones, [
      meeting({ id: "c", status: "CANCELLED" }),
      meeting({ id: "far", dayKey: "2026-04-01" }),
      meeting({ id: "other", employeeId: "emp-2" }),
    ], "2026-01-20");
    expect(resolved.find((m) => m.kind === "THIRTY_DAY")?.status).toBe("due");
  });
});

describe("selectDueReminders", () => {
  const resolved = resolveMilestones(computeEmployeeMilestones(emp, "2026-01-01", "2026-05-01"), [], "2026-02-07");

  it("picks unscheduled milestones due within the next 7 days", () => {
    expect(selectDueReminders(resolved, "2026-02-07", new Set()).map((m) => m.kind)).toEqual(["THIRTY_DAY"]);
    expect(selectDueReminders(resolved, "2026-02-06", new Set())).toEqual([]);
  });

  it("catches up a missed day but never re-sends", () => {
    expect(selectDueReminders(resolved, "2026-02-10", new Set()).map((m) => m.kind)).toEqual(["THIRTY_DAY"]);
    expect(selectDueReminders(resolved, "2026-02-10", new Set(["emp-1:THIRTY_DAY:2026-02-14"]))).toEqual([]);
  });

  it("skips scheduled and past milestones", () => {
    const scheduled = resolved.map((m) => ({ ...m, status: "scheduled" as const }));
    expect(selectDueReminders(scheduled, "2026-02-10", new Set())).toEqual([]);
    expect(selectDueReminders(resolved, "2026-02-15", new Set())).toEqual([]);
  });
});

describe("milestone visibility", () => {
  // ceo <- director <- manager <- emp-1 ; peer reports to manager too
  const managerOf = new Map<string, string | null>([
    ["emp-1", "manager"], ["peer", "manager"], ["manager", "director"], ["director", "ceo"], ["ceo", null],
  ]);
  const employee = { id: "emp-1", departmentId: "closers" };

  it("admins/HR and the whole manager chain see milestones", () => {
    expect(canSeeEmployeeMilestones({ role: "HR", employeeId: "hr" }, employee, managerOf)).toBe(true);
    expect(canSeeEmployeeMilestones({ role: "MANAGER", employeeId: "manager" }, employee, managerOf)).toBe(true);
    expect(canSeeEmployeeMilestones({ role: "MANAGER", employeeId: "director" }, employee, managerOf)).toBe(true);
  });

  it("the employee, peers and unrelated managers do not", () => {
    expect(canSeeEmployeeMilestones({ role: "EMPLOYEE", employeeId: "emp-1" }, employee, managerOf)).toBe(false);
    expect(canSeeEmployeeMilestones({ role: "EMPLOYEE", employeeId: "peer" }, employee, managerOf)).toBe(false);
    expect(canSeeEmployeeMilestones({ role: "MANAGER", employeeId: "peer" }, employee, managerOf)).toBe(false);
  });

  it("oversight recipients see milestones for their departments", () => {
    expect(canSeeEmployeeMilestones({ role: "EMPLOYEE", employeeId: "x", oversightDepartmentIds: ["closers"] }, employee, managerOf)).toBe(true);
    expect(canSeeEmployeeMilestones({ role: "EMPLOYEE", employeeId: "x", oversightDepartmentIds: ["sales"] }, employee, managerOf)).toBe(false);
    expect(canSeeEmployeeMilestones({ role: "EMPLOYEE", employeeId: "x", oversightDepartmentIds: "all" }, employee, managerOf)).toBe(true);
  });

  it("only admins and chain managers can schedule", () => {
    expect(canScheduleEmployeeMilestones({ role: "ADMIN", employeeId: "a" }, "emp-1", managerOf)).toBe(true);
    expect(canScheduleEmployeeMilestones({ role: "MANAGER", employeeId: "director" }, "emp-1", managerOf)).toBe(true);
    expect(canScheduleEmployeeMilestones({ role: "EMPLOYEE", employeeId: "manager" }, "emp-1", managerOf)).toBe(false);
    expect(canScheduleEmployeeMilestones({ role: "MANAGER", employeeId: "x", oversightDepartmentIds: "all" }, "emp-1", managerOf)).toBe(false);
  });

  it("survives reporting-line loops", () => {
    const loop = new Map<string, string | null>([["a", "b"], ["b", "a"]]);
    expect(canSeeEmployeeMilestones({ role: "MANAGER", employeeId: "z" }, { id: "a" }, loop)).toBe(false);
  });
});
