import { describe, it, expect } from "vitest";
import {
  normalizeEmail, normalizePhone, normalizeName, nameKeys,
  parseDate, cleanPhone, applyMapping, validateRow,
} from "@/lib/import-export/normalize";

describe("normalizeEmail", () => {
  it("lowercases and strips gmail dots and tags", () => {
    expect(normalizeEmail(" John.Doe+hr@Gmail.com ")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("a.b@coastaldebt.com")).toBe("ab@coastaldebt.com");
  });
  it("returns empty for junk or pending placeholders", () => {
    expect(normalizeEmail("not an email")).toBe("");
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail("jane.doe@pending.local")).toBe("");
  });
});

describe("normalizePhone / cleanPhone", () => {
  it("keeps the last ten digits", () => {
    expect(normalizePhone("+1 (305) 555-0142")).toBe("3055550142");
    expect(normalizePhone("555-0142")).toBe("");
  });
  it("cleanPhone keeps digits and a leading plus", () => {
    expect(cleanPhone("+1 (305) 555-0142")).toBe("+13055550142");
    expect(cleanPhone("305.555.0142")).toBe("3055550142");
  });
});

describe("normalizeName / nameKeys", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeName("  José  O'Brien-Smith ")).toBe("jose obriensmith");
  });
  it("produces unordered keys including preferred name", () => {
    expect(nameKeys("Maria", "Garcia")).toEqual(["garcia|maria"]);
    expect(nameKeys("Garcia", "Maria")).toEqual(["garcia|maria"]);
    expect(nameKeys("William", "Smith", "Bill")).toEqual(["smith|william", "bill|smith"]);
    expect(nameKeys("", "Smith")).toEqual([]);
  });
});

describe("parseDate", () => {
  it("accepts ISO, US, two-digit years, month names and excel serials", () => {
    expect(parseDate("2024-03-01")).toBe("2024-03-01");
    expect(parseDate("2024-03-01T10:00:00Z")).toBe("2024-03-01");
    expect(parseDate("3/1/2024")).toBe("2024-03-01");
    expect(parseDate("03-01-24")).toBe("2024-03-01");
    expect(parseDate("March 1, 2024")).toBe("2024-03-01");
    expect(parseDate("1 Mar 2024")).toBe("2024-03-01");
    expect(parseDate("45352")).toBe("2024-03-01");
  });
  it("rejects garbage and impossible dates", () => {
    expect(parseDate("soon")).toBeNull();
    expect(parseDate("13/45/2024")).toBeNull();
    expect(parseDate("2024-02-30")).toBeNull();
  });
});

describe("applyMapping", () => {
  it("collects mapped, non-empty cells and ignores skipped columns", () => {
    expect(applyMapping(["Ada", "", "Lovelace", "x"], ["firstName", "email", "lastName", "skip"]))
      .toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });
  it("keeps the first non-empty value when two columns feed one field", () => {
    expect(applyMapping(["", "a@b.co"], ["email", "email"])).toEqual({ email: "a@b.co" });
  });
});

describe("validateRow", () => {
  it("cleans dates, emails, phones and status", () => {
    const r = validateRow({ firstName: "Ada", lastName: "Lovelace", email: " ADA@X.com ", phone: "(305) 555-0142", startDate: "3/1/2024", status: "active" });
    expect(r.errors).toEqual([]);
    expect(r.data).toEqual({ firstName: "Ada", lastName: "Lovelace", email: "ada@x.com", phone: "3055550142", startDate: "2024-03-01", status: "ACTIVE" });
  });
  it("reports missing names, bad emails, bad dates and unknown statuses", () => {
    const r = validateRow({ firstName: "Ada", email: "nope", birthday: "yesterday", status: "retired" });
    expect(r.errors).toEqual([
      { field: "lastName", message: "Last name is required" },
      { field: "email", message: "Not a valid email address" },
      { field: "status", message: "Status must be one of PENDING, ACTIVE, PRE_ONBOARDING, TRAINING, ONBOARDING, OFFBOARDED" },
      { field: "birthday", message: "Unrecognized date" },
    ]);
  });
});
