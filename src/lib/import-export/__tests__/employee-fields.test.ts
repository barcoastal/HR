import { describe, it, expect } from "vitest";
import { EMPLOYEE_FIELDS, FIELD_BY_KEY, normalizeHeader, autoDetectMapping } from "@/lib/import-export/employee-fields";

describe("EMPLOYEE_FIELDS", () => {
  it("has unique keys and unique synonyms", () => {
    const keys = EMPLOYEE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const syns = EMPLOYEE_FIELDS.flatMap((f) => f.synonyms);
    expect(new Set(syns).size).toBe(syns.length);
  });
  it("marks first and last name required", () => {
    expect(FIELD_BY_KEY.firstName.required).toBe(true);
    expect(FIELD_BY_KEY.lastName.required).toBe(true);
    expect(FIELD_BY_KEY.email.required).toBeUndefined();
  });
});

describe("normalizeHeader", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeHeader("  First_Name* ")).toBe("first name");
    expect(normalizeHeader("E-Mail Address")).toBe("e mail address");
    expect(normalizeHeader("Start.Date")).toBe("start date");
  });
});

describe("autoDetectMapping", () => {
  it("maps known headers and skips unknown ones", () => {
    expect(autoDetectMapping(["First Name", "Surname", "Work Email", "Reports To", "Favourite colour"]))
      .toEqual(["firstName", "lastName", "email", "manager", "skip"]);
  });
  it("matches the field key or label directly", () => {
    expect(autoDetectMapping(["jobTitle", "ZIP code"])).toEqual(["jobTitle", "zipCode"]);
  });
  it("uses each field only once (first column wins)", () => {
    expect(autoDetectMapping(["Email", "E-mail"])).toEqual(["email", "skip"]);
  });
});
