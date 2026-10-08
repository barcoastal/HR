import { describe, expect, it } from "vitest";
import { planMergeLogins, type GroupLogin } from "@/lib/import-export/merge-logins";

const login = (employeeId: string, email: string): GroupLogin => ({ userId: `user-${employeeId}`, employeeId, email });

describe("planMergeLogins", () => {
  it("keeps the login whose address matches the Result email, even when it belongs to a duplicate", () => {
    const plan = planMergeLogins({
      primaryId: "old",
      duplicateIds: ["new"],
      logins: [login("old", "old@corp.com"), login("new", "new@corp.com")],
      resultEmail: "new@corp.com",
    });
    expect(plan.kept).toEqual(login("new", "new@corp.com"));
    expect(plan.detached).toEqual([login("old", "old@corp.com")]);
    expect(plan.notes).toEqual([]);
  });

  it("keeps the primary's login when the Result email is the primary's address", () => {
    const plan = planMergeLogins({
      primaryId: "old",
      duplicateIds: ["new"],
      logins: [login("old", "old@corp.com"), login("new", "new@corp.com")],
      resultEmail: "old@corp.com",
    });
    expect(plan.kept).toEqual(login("old", "old@corp.com"));
    expect(plan.detached).toEqual([login("new", "new@corp.com")]);
  });

  it("falls back to the primary's login and explains when the Result email is not a login", () => {
    const plan = planMergeLogins({
      primaryId: "old",
      duplicateIds: ["new"],
      logins: [login("old", "old@corp.com"), login("new", "new@corp.com")],
      resultEmail: "personal@gmail.com",
    });
    expect(plan.kept).toEqual(login("old", "old@corp.com"));
    expect(plan.detached).toEqual([login("new", "new@corp.com")]);
    expect(plan.notes).toEqual(["Email kept as old@corp.com — it's the login"]);
  });

  it("moves a duplicate's login to a primary that has none", () => {
    const plan = planMergeLogins({
      primaryId: "old",
      duplicateIds: ["new"],
      logins: [login("new", "new@corp.com")],
      resultEmail: "old@corp.com",
    });
    expect(plan.kept).toEqual(login("new", "new@corp.com"));
    expect(plan.detached).toEqual([]);
    expect(plan.notes).toEqual(["Email kept as new@corp.com — it's the login"]);
  });

  it("matches the Result email case-insensitively and ignores surrounding spaces", () => {
    const plan = planMergeLogins({
      primaryId: "old",
      duplicateIds: ["new"],
      logins: [login("old", "old@corp.com"), login("new", "New@Corp.com")],
      resultEmail: "  new@corp.COM ",
    });
    expect(plan.kept?.employeeId).toBe("new");
    expect(plan.notes).toEqual([]);
  });

  it("returns no login when nobody in the group has one", () => {
    const plan = planMergeLogins({ primaryId: "a", duplicateIds: ["b"], logins: [], resultEmail: "a@corp.com" });
    expect(plan).toEqual({ kept: null, detached: [], notes: [] });
  });

  it("orders detached logins primary first, then duplicates in the order given", () => {
    const plan = planMergeLogins({
      primaryId: "p",
      duplicateIds: ["d2", "d1"],
      logins: [login("d1", "d1@corp.com"), login("p", "p@corp.com"), login("d2", "d2@corp.com")],
      resultEmail: "d1@corp.com",
    });
    expect(plan.kept?.employeeId).toBe("d1");
    expect(plan.detached.map((l) => l.employeeId)).toEqual(["p", "d2"]);
  });
});
