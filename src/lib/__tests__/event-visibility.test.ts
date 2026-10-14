import { describe, expect, it } from "vitest";
import { canSeeAudiencePost, normalizeEventVisibility, type AudienceFields } from "@/lib/event-audience";
import { calendarCategoryOf, calendarChipClass, CALENDAR_COLORS, sanitizeCategoryColors } from "@/lib/calendar-colors";
import { oversightCoversDepartment } from "@/lib/review-milestones";

const invitedOnly = (visibility: string, over: Partial<AudienceFields> = {}): AudienceFields => ({
  audienceType: "employees",
  audienceDeptIds: null,
  audienceEmployeeIds: JSON.stringify(["invitee"]),
  authorId: "author",
  eventVisibility: visibility,
  ...over,
});

describe("event visibility partitions", () => {
  it("everyone keeps the existing audience rules", () => {
    const post = invitedOnly("everyone");
    expect(canSeeAudiencePost(post, { employeeId: "invitee", role: "EMPLOYEE" })).toBe(true);
    expect(canSeeAudiencePost(post, { employeeId: "other", role: "EMPLOYEE" })).toBe(false);
    expect(canSeeAudiencePost(post, { employeeId: "hr", role: "HR" })).toBe(true);
    expect(canSeeAudiencePost({ ...post, audienceType: "all", eventVisibility: null }, { employeeId: "x", role: "EMPLOYEE" })).toBe(true);
  });

  it("managers & admins only", () => {
    const post = invitedOnly("managers");
    expect(canSeeAudiencePost(post, { employeeId: "m", role: "MANAGER" })).toBe(true);
    expect(canSeeAudiencePost(post, { employeeId: "a", role: "ADMIN" })).toBe(true);
    expect(canSeeAudiencePost(post, { employeeId: "e", role: "EMPLOYEE" })).toBe(false);
    expect(canSeeAudiencePost(post, { employeeId: "invitee", role: "EMPLOYEE" })).toBe(true);
    expect(canSeeAudiencePost(post, { employeeId: "author", role: "EMPLOYEE" })).toBe(true);
  });

  it("admins / HR only", () => {
    const post = invitedOnly("admins");
    expect(canSeeAudiencePost(post, { employeeId: "m", role: "MANAGER" })).toBe(false);
    expect(canSeeAudiencePost(post, { employeeId: "h", role: "HR" })).toBe(true);
    expect(canSeeAudiencePost(post, { employeeId: "s", role: "SUPER_ADMIN" })).toBe(true);
  });

  it("only invited people — not even admins", () => {
    const post = invitedOnly("invited");
    expect(canSeeAudiencePost(post, { employeeId: "s", role: "SUPER_ADMIN" })).toBe(false);
    expect(canSeeAudiencePost(post, { employeeId: "invitee", role: "EMPLOYEE" })).toBe(true);
    expect(canSeeAudiencePost(invitedOnly("invited", { audienceType: "departments", audienceDeptIds: JSON.stringify(["d1"]), audienceEmployeeIds: null }), { employeeId: "x", departmentId: "d1", role: "EMPLOYEE" })).toBe(true);
  });

  it("a company-wide audience cannot leak a restricted event", () => {
    const post = invitedOnly("admins", { audienceType: "all", audienceEmployeeIds: null });
    expect(canSeeAudiencePost(post, { employeeId: "e", role: "EMPLOYEE" })).toBe(false);
  });

  it("unknown visibility values fall back to everyone", () => {
    expect(normalizeEventVisibility("weird")).toBe("everyone");
    expect(normalizeEventVisibility(undefined)).toBe("everyone");
  });
});

describe("calendar colors", () => {
  it("event color beats category color beats built-in", () => {
    expect(calendarChipClass("feed-event", { company: "red" }, "teal")).toBe(CALENDAR_COLORS.teal.chip);
    expect(calendarChipClass("feed-event", { company: "red" })).toBe(CALENDAR_COLORS.red.chip);
    expect(calendarChipClass("feed-event")).toBe("bg-blue-500/10 text-blue-700");
    expect(calendarChipClass("review-milestone", { review: "orange" })).toBe(CALENDAR_COLORS.orange.chip);
  });

  it("maps item types to layers", () => {
    expect(calendarCategoryOf("holiday-jewish")).toBe("holiday");
    expect(calendarCategoryOf("working-remotely")).toBe("time-off");
    expect(calendarCategoryOf("performance-review")).toBe("review");
    expect(calendarCategoryOf("birthday")).toBe("people");
  });

  it("drops unknown categories and colors", () => {
    expect(sanitizeCategoryColors([
      { category: "company", color: "green" },
      { category: "nope", color: "green" },
      { category: "training", color: "chartreuse" },
    ])).toEqual({ company: "green" });
  });
});

describe("oversight department scope", () => {
  it("an empty list covers every department", () => {
    expect(oversightCoversDepartment([], null)).toBe(true);
    expect(oversightCoversDepartment(["closers"], "closers")).toBe(true);
    expect(oversightCoversDepartment(["closers"], "ops")).toBe(false);
    expect(oversightCoversDepartment(["closers"], null)).toBe(false);
  });
});
