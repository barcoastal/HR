import { describe, expect, it } from "vitest";
import {
  buildGustoIndex,
  diffGustoData,
  emailKey,
  gustoDisplayName,
  matchGustoPerson,
  selectGustoChanges,
  type SyncCandidate,
} from "@/lib/gusto-sync/match";
import type { GustoPerson } from "@/lib/gusto-sync/types";

const jane: GustoPerson = {
  gustoId: "g-jane",
  data: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com", personalEmail: "jd@gmail.com", phone: "+15551234567", jobTitle: "Engineer" },
};
const john: GustoPerson = {
  gustoId: "g-john",
  data: { firstName: "John", lastName: "Doe", email: "john@acme.com", jobTitle: "Designer" },
};
const johnTwo: GustoPerson = {
  gustoId: "g-john-2",
  data: { firstName: "John", lastName: "Doe", email: "john.doe@acme.com" },
};
const bob: GustoPerson = {
  gustoId: "g-bob",
  data: { firstName: "Robert", preferredName: "Bob", lastName: "Stone", email: "bob@acme.com" },
};

const candidate = (data: SyncCandidate["data"], gustoEmployeeId: string | null = null): SyncCandidate => ({
  id: "e1",
  gustoEmployeeId,
  data,
});

describe("emailKey", () => {
  it("lowercases and trims, and ignores the pending placeholder", () => {
    expect(emailKey("  Jane@Acme.com ")).toBe("jane@acme.com");
    expect(emailKey("someone@pending.local")).toBe("");
    expect(emailKey(null)).toBe("");
  });
});

describe("matchGustoPerson", () => {
  const index = () => buildGustoIndex([jane, john, johnTwo, bob]);

  it("uses the stored gustoEmployeeId before anything else", () => {
    const hit = matchGustoPerson(candidate({ firstName: "Someone", lastName: "Else", email: "jane@acme.com" }, "g-bob"), index());
    expect(hit).toEqual({ person: bob, matchedBy: "gustoId" });
  });

  it("returns null when the stored gustoEmployeeId is no longer in Gusto", () => {
    expect(matchGustoPerson(candidate({ firstName: "Jane", lastName: "Doe", email: "jane@acme.com" }, "g-gone"), index())).toBeNull();
  });

  it("matches the person's email against Gusto's work email, case-insensitively", () => {
    const hit = matchGustoPerson(candidate({ firstName: "J", lastName: "D", email: "JANE@ACME.COM" }), index());
    expect(hit).toEqual({ person: jane, matchedBy: "email" });
  });

  it("matches the person's email against Gusto's personal email", () => {
    const hit = matchGustoPerson(candidate({ firstName: "J", lastName: "D", email: "jd@gmail.com" }), index());
    expect(hit).toEqual({ person: jane, matchedBy: "email" });
  });

  it("falls back to the person's personal email", () => {
    const hit = matchGustoPerson(candidate({ firstName: "J", lastName: "D", email: "other@x.com", personalEmail: "Jane@acme.com" }), index());
    expect(hit).toEqual({ person: jane, matchedBy: "personalEmail" });
  });

  it("never treats the pending placeholder as an email", () => {
    const hit = matchGustoPerson(candidate({ firstName: "Robert", lastName: "Stone", email: "x@pending.local" }), index());
    expect(hit).toEqual({ person: bob, matchedBy: "name" });
  });

  it("matches a unique name, including preferred names on either side", () => {
    expect(matchGustoPerson(candidate({ firstName: "Bob", lastName: "Stone", email: "b@pending.local" }), index())).toEqual({ person: bob, matchedBy: "name" });
    expect(matchGustoPerson(candidate({ firstName: "Robert", lastName: "Stone" }), index())).toEqual({ person: bob, matchedBy: "name" });
    expect(matchGustoPerson(candidate({ firstName: "Jane", lastName: "Doe" }), index())).toEqual({ person: jane, matchedBy: "name" });
  });

  it("returns null for an ambiguous name", () => {
    expect(matchGustoPerson(candidate({ firstName: "John", lastName: "Doe" }), index())).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchGustoPerson(candidate({ firstName: "Nobody", lastName: "Here", email: "nobody@acme.com" }), index())).toBeNull();
  });

  it("never offers a Gusto record that is already linked to someone else", () => {
    const claimed = buildGustoIndex([jane, john, johnTwo, bob], ["g-jane", "g-john-2"]);
    expect(matchGustoPerson(candidate({ firstName: "J", lastName: "D", email: "jane@acme.com" }), claimed)).toBeNull();
    // With the duplicate John claimed, the name is unique again.
    expect(matchGustoPerson(candidate({ firstName: "John", lastName: "Doe" }), claimed)).toEqual({ person: john, matchedBy: "name" });
  });
});

describe("diffGustoData", () => {
  it("lists fields where Gusto has a value that differs, with the current value", () => {
    const changes = diffGustoData({ firstName: "Jane", lastName: "Doe", jobTitle: "Eng" }, { firstName: "Jane", lastName: "Doe", jobTitle: "Engineer", city: "Austin" });
    expect(changes).toEqual([
      { key: "jobTitle", label: "Job title", current: "Eng", incoming: "Engineer" },
      { key: "city", label: "City", current: "", incoming: "Austin" },
    ]);
  });

  it("ignores fields Gusto leaves empty", () => {
    expect(diffGustoData({ jobTitle: "Engineer" }, { jobTitle: "" })).toEqual([]);
    expect(diffGustoData({ jobTitle: "Engineer" }, {})).toEqual([]);
  });

  it("compares phones by digits and emails and relations case-insensitively", () => {
    expect(diffGustoData({ phone: "(555) 123-4567" }, { phone: "+5551234567" })).toEqual([]);
    expect(diffGustoData({ phone: "5551234567" }, { phone: "5559999999" })).toHaveLength(1);
    expect(diffGustoData({ email: "Jane@Acme.com" }, { email: "jane@acme.com" })).toEqual([]);
    expect(diffGustoData({ department: "engineering", manager: "JOHN DOE" }, { department: "Engineering", manager: "John Doe" })).toEqual([]);
    expect(diffGustoData({ department: "Engineering" }, { department: "Design" })).toHaveLength(1);
  });

  it("never includes status", () => {
    expect(diffGustoData({ status: "PENDING" }, { status: "ACTIVE" })).toEqual([]);
  });
});

describe("selectGustoChanges", () => {
  const changes = diffGustoData({ jobTitle: "Eng" }, { jobTitle: "Engineer", city: "Austin" });

  it("fill writes only fields that are empty here", () => {
    expect(selectGustoChanges(changes, "fill")).toEqual({ city: "Austin" });
  });

  it("overwrite writes every differing field", () => {
    expect(selectGustoChanges(changes, "overwrite")).toEqual({ jobTitle: "Engineer", city: "Austin" });
  });
});

describe("gustoDisplayName", () => {
  it("joins first and last, tolerating blanks", () => {
    expect(gustoDisplayName({ firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
    expect(gustoDisplayName({ lastName: "Doe" })).toBe("Doe");
  });
});
