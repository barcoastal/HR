import { describe, it, expect } from "vitest";
import { matchManager, type ManagerCandidate } from "@/lib/import-export/manager-match";

const person = (id: string, p: Partial<ManagerCandidate> = {}): ManagerCandidate => ({
  id, firstName: "First", lastName: "Last", preferredName: null, email: `${id}@corp.com`, ...p,
});

const people: ManagerCandidate[] = [
  person("ada", { firstName: "Augusta", lastName: "Lovelace", preferredName: "Ada", email: "ada@corp.com" }),
  person("grace", { firstName: "Grace", lastName: "Hopper", email: "grace.hopper@corp.com" }),
  person("maria1", { firstName: "María", lastName: "García", email: "maria.g@corp.com" }),
  person("maria2", { firstName: "Maria", lastName: "Garcia", email: "mgarcia@corp.com" }),
  person("mary", { firstName: "Mary Ann", lastName: "Smith", email: "mary@corp.com" }),
];

describe("matchManager", () => {
  it("matches an email reference exactly, ignoring case and whitespace", () => {
    expect(matchManager("  Grace.Hopper@Corp.com ", people)).toEqual({ id: "grace" });
  });

  it("does not fall back to names when the reference looks like an email", () => {
    expect(matchManager("grace@elsewhere.com", people)).toEqual({ error: "none" });
  });

  it("matches a 'First Last' reference by name", () => {
    expect(matchManager("Grace Hopper", people)).toEqual({ id: "grace" });
  });

  it("matches on preferred name + last name", () => {
    expect(matchManager("Ada Lovelace", people)).toEqual({ id: "ada" });
  });

  it("matches on legal first name + last name", () => {
    expect(matchManager("Augusta Lovelace", people)).toEqual({ id: "ada" });
  });

  it("accepts 'Last First' and 'Last, First' order", () => {
    expect(matchManager("Hopper Grace", people)).toEqual({ id: "grace" });
    expect(matchManager("Hopper, Grace", people)).toEqual({ id: "grace" });
  });

  it("ignores accents, case and extra spaces", () => {
    expect(matchManager("  mary   ann SMITH ", people)).toEqual({ id: "mary" });
    expect(matchManager("maria garcía", [people[2]])).toEqual({ id: "maria1" });
  });

  it("reports ambiguity when more than one person matches", () => {
    expect(matchManager("Maria Garcia", people)).toEqual({ error: "ambiguous" });
  });

  it("reports none when nobody matches or the reference is empty", () => {
    expect(matchManager("Alan Turing", people)).toEqual({ error: "none" });
    expect(matchManager("Grace", people)).toEqual({ error: "none" });
    expect(matchManager("", people)).toEqual({ error: "none" });
    expect(matchManager("Grace Hopper", [])).toEqual({ error: "none" });
  });

  it("counts a person once even when several keys hit", () => {
    const twice = [person("x", { firstName: "Ada", lastName: "Lovelace", preferredName: "Ada" })];
    expect(matchManager("Ada Lovelace", twice)).toEqual({ id: "x" });
  });
});
