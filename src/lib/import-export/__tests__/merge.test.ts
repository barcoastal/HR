import { describe, it, expect } from "vitest";
import { defaultFieldChoices, buildMergePlan } from "@/lib/import-export/merge";
import { employeeToRowData } from "@/lib/import-export/employee-row";
import type { MergeMember } from "@/lib/import-export/types";

const r1: MergeMember = { ref: { kind: "row", id: "r1" }, rowNumber: 4, data: { firstName: "Ada", lastName: "Lovelace", email: "ada@gmail.com", phone: "3055550142" } };
const r2: MergeMember = { ref: { kind: "row", id: "r2" }, rowNumber: 9, data: { firstName: "Ada", lastName: "Lovelace", city: "Miami" } };
const e1: MergeMember = { ref: { kind: "employee", id: "e1" }, data: { firstName: "Ada", lastName: "Lovelace", email: "ada@corp.com", jobTitle: "Engineer" } };

describe("defaultFieldChoices", () => {
  it("prefers the primary and fills blanks from the others in order", () => {
    const c = defaultFieldChoices([r1, r2, e1], e1.ref);
    expect(c.email).toEqual(e1.ref);
    expect(c.jobTitle).toEqual(e1.ref);
    expect(c.phone).toEqual(r1.ref);
    expect(c.city).toEqual(r2.ref);
    expect(c.bio).toBeUndefined();
  });
});

describe("buildMergePlan", () => {
  it("row primary → CREATE on the primary row, others merged away", () => {
    const plan = buildMergePlan([r1, r2], r1.ref, { city: r2.ref });
    expect(plan).toEqual({
      carrierRowId: "r1", action: "CREATE", targetEmployeeId: null,
      data: { firstName: "Ada", lastName: "Lovelace", email: "ada@gmail.com", phone: "3055550142", city: "Miami" },
      mergedAwayRowIds: ["r2"],
    });
  });
  it("employee primary → UPDATE carried by the lowest row, honoring explicit choices", () => {
    const plan = buildMergePlan([r2, r1, e1], e1.ref, { email: r1.ref });
    expect(plan.carrierRowId).toBe("r1");
    expect(plan.action).toBe("UPDATE");
    expect(plan.targetEmployeeId).toBe("e1");
    expect(plan.data.email).toBe("ada@gmail.com");
    expect(plan.data.jobTitle).toBe("Engineer");
    expect(plan.mergedAwayRowIds).toEqual(["r2"]);
  });
  it("throws when there is no row to carry the merge", () => {
    expect(() => buildMergePlan([e1], e1.ref, {})).toThrow();
  });
});

describe("employeeToRowData", () => {
  it("flattens relations and formats dates", () => {
    const data = employeeToRowData({
      firstName: "Ada", middleName: null, lastName: "Lovelace", preferredName: null, pronouns: "she/her",
      email: "ada@corp.com", phone: null, jobTitle: "Engineer", location: null, status: "ACTIVE",
      startDate: new Date("2024-03-01T00:00:00Z"), birthday: null, anniversaryDate: null, benefitsEligibleDate: null,
      address: null, city: null, state: null, zipCode: null, country: null,
      emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelation: null,
      bio: null, hobbies: null, dietaryRestrictions: null, tShirtSize: null,
      department: { name: "Engineering" }, team: null, manager: { firstName: "Grace", lastName: "Hopper", preferredName: null },
    });
    expect(data).toEqual({ firstName: "Ada", lastName: "Lovelace", pronouns: "she/her", email: "ada@corp.com", jobTitle: "Engineer", status: "ACTIVE", startDate: "2024-03-01", department: "Engineering", manager: "Grace Hopper" });
  });
});
