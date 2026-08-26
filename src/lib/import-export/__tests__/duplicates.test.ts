import { describe, it, expect } from "vitest";
import { detectDuplicates, groupKey, pairKey } from "@/lib/import-export/duplicates";
import type { RowLite, ExistingEmployeeLite } from "@/lib/import-export/types";

const row = (id: string, n: number, data: RowLite["data"]): RowLite => ({ id, rowNumber: n, data });
const emp = (id: string, e: Partial<ExistingEmployeeLite> = {}): ExistingEmployeeLite => ({
  id, firstName: "X", lastName: "Y", email: `${id}@corp.com`, phone: null, ...e,
});

describe("detectDuplicates", () => {
  it("groups two rows with the same normalized email", () => {
    const groups = detectDuplicates([
      row("r1", 1, { firstName: "Ada", lastName: "Lovelace", email: "ada.l@gmail.com" }),
      row("r2", 2, { firstName: "A.", lastName: "Lovelace", email: "adal+x@gmail.com" }),
    ], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["email"]);
    expect(groups[0].members).toEqual([{ kind: "row", id: "r1" }, { kind: "row", id: "r2" }]);
  });

  it("matches a row against an existing employee by phone and name, listing rows first", () => {
    const groups = detectDuplicates(
      [row("r1", 3, { firstName: "Maria", lastName: "Garcia", phone: "3055550142" })],
      [emp("e1", { firstName: "María", lastName: "García", phone: "+1 (305) 555-0142" })],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["phone", "name"]);
    expect(groups[0].members).toEqual([{ kind: "row", id: "r1" }, { kind: "employee", id: "e1" }]);
  });

  it("matches on preferred name and ignores pending placeholder emails", () => {
    const groups = detectDuplicates(
      [row("r1", 1, { firstName: "Bill", lastName: "Smith", email: "bill.smith@pending.local" })],
      [emp("e1", { firstName: "William", lastName: "Smith", preferredName: "Bill", email: "william.smith@pending.local" })],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["name"]);
  });

  it("never groups two existing employees without a row between them", () => {
    const groups = detectDuplicates([], [
      emp("e1", { firstName: "Sam", lastName: "Lee" }),
      emp("e2", { firstName: "Sam", lastName: "Lee" }),
    ]);
    expect(groups).toEqual([]);
  });

  it("clusters transitively and orders strong groups before name-only groups", () => {
    const groups = detectDuplicates([
      row("r1", 1, { firstName: "Jo", lastName: "Kim" }),
      row("r2", 2, { firstName: "Jo", lastName: "Kim" }),
      row("r3", 5, { firstName: "Pat", lastName: "Ng", email: "pat@corp.com" }),
      row("r4", 6, { firstName: "Patricia", lastName: "Ng", phone: "3055550199" }),
    ], [emp("e1", { firstName: "P", lastName: "Ng", email: "PAT@corp.com", phone: "305-555-0199" })]);
    expect(groups).toHaveLength(2);
    expect(groups[0].members.map((m) => m.id)).toEqual(["r3", "r4", "e1"]);
    expect(groups[0].reasons).toEqual(["email", "phone"]);
    expect(groups[1].members.map((m) => m.id)).toEqual(["r1", "r2"]);
  });


  it("produces a stable key", () => {
    expect(groupKey([{ kind: "row", id: "b" }, { kind: "employee", id: "a" }])).toBe("employee:a|row:b");
  });
});

describe("detectDuplicates with pairEmployees", () => {
  it("pairs two existing employees that share a name", () => {
    const groups = detectDuplicates([], [
      emp("e2", { firstName: "Sam", lastName: "Lee" }),
      emp("e1", { firstName: "Sam", lastName: "Lee" }),
    ], { pairEmployees: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["name"]);
    expect(groups[0].members).toEqual([{ kind: "employee", id: "e1" }, { kind: "employee", id: "e2" }]);
    expect(groups[0].key).toBe("employee:e1|employee:e2");
  });

  it("still ignores pending placeholder emails and orders strong groups first", () => {
    const groups = detectDuplicates([], [
      emp("n1", { firstName: "Jo", lastName: "Kim", email: "jo.kim@pending.local" }),
      emp("n2", { firstName: "Jo", lastName: "Kim", email: "jokim@pending.local" }),
      emp("p1", { firstName: "Ana", lastName: "Ruiz", phone: "305-555-0177" }),
      emp("p2", { firstName: "Anna", lastName: "Ruiz", phone: "+1 305 555 0177" }),
    ], { pairEmployees: true });
    expect(groups).toHaveLength(2);
    expect(groups[0].members.map((m) => m.id)).toEqual(["p1", "p2"]);
    expect(groups[0].reasons).toEqual(["phone"]);
    expect(groups[1].members.map((m) => m.id)).toEqual(["n1", "n2"]);
    expect(groups[1].reasons).toEqual(["name"]);
  });

  it("leaves dismissed employee pairs alone but keeps their other links", () => {
    const people = [
      emp("e1", { firstName: "Sam", lastName: "Lee" }),
      emp("e2", { firstName: "Sam", lastName: "Lee" }),
      emp("e3", { firstName: "Sam", lastName: "Lee", phone: "3055550100" }),
      emp("e4", { firstName: "Kit", lastName: "Ng", phone: "3055550100" }),
    ];
    const dismissed = new Set([pairKey("e2", "e1"), pairKey("e1", "e3"), pairKey("e2", "e3")]);
    const groups = detectDuplicates([], people, { pairEmployees: true, dismissedPairs: dismissed });
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(["e3", "e4"]);
    expect(groups[0].reasons).toEqual(["phone"]);
  });

  it("does not pair employees unless asked, even with dismissals supplied", () => {
    const groups = detectDuplicates([], [
      emp("e1", { firstName: "Sam", lastName: "Lee" }),
      emp("e2", { firstName: "Sam", lastName: "Lee" }),
    ], { dismissedPairs: new Set() });
    expect(groups).toEqual([]);
  });

  it("still links employees through a row when pairing is on", () => {
    const groups = detectDuplicates(
      [row("r1", 1, { firstName: "Sam", lastName: "Lee", email: "sam@corp.com" })],
      [emp("e1", { firstName: "Sam", lastName: "Lee" }), emp("e2", { firstName: "Samuel", lastName: "Lee", email: "SAM@corp.com" })],
      { pairEmployees: true },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(["r1", "e1", "e2"]);
    expect(groups[0].reasons).toEqual(["email", "name"]);
  });
});

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey("b", "a")).toBe("a|b");
    expect(pairKey("a", "b")).toBe("a|b");
  });
});
