import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employee: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { employee: mocks.employee } }));
import { filterByRehireStatus, parseRehireChoice, rehireStatus } from "@/lib/rehire-eligibility";
import { saveRehireEligibility } from "@/lib/rehire-eligibility-update";

describe("rehireStatus", () => {
  it("treats an unanswered question as undecided, not as a no", () => {
    expect(rehireStatus(null)).toBe("UNDECIDED");
  });

  it("reports a yes as eligible", () => {
    expect(rehireStatus(true)).toBe("ELIGIBLE");
  });

  it("reports a no as not eligible", () => {
    expect(rehireStatus(false)).toBe("NOT_ELIGIBLE");
  });
});

describe("parseRehireChoice", () => {
  it("reads the form's choices", () => {
    expect([parseRehireChoice("yes"), parseRehireChoice("no"), parseRehireChoice("")]).toEqual([true, false, null]);
  });
});

describe("filterByRehireStatus", () => {
  const people = [
    { id: "ana", rehireEligible: true },
    { id: "ben", rehireEligible: false },
    { id: "cal", rehireEligible: null },
    { id: "dee", rehireEligible: true },
  ];
  const ids = (list: { id: string }[]) => list.map((person) => person.id);

  it("shows everyone when no filter is chosen", () => {
    expect(ids(filterByRehireStatus(people, "ALL"))).toEqual(["ana", "ben", "cal", "dee"]);
  });

  it("shows only the people who can be rehired", () => {
    expect(ids(filterByRehireStatus(people, "ELIGIBLE"))).toEqual(["ana", "dee"]);
  });

  it("shows only the people who cannot be rehired", () => {
    expect(ids(filterByRehireStatus(people, "NOT_ELIGIBLE"))).toEqual(["ben"]);
  });

  it("shows the people still waiting on a decision", () => {
    expect(ids(filterByRehireStatus(people, "UNDECIDED"))).toEqual(["cal"]);
  });
});

describe("saveRehireEligibility", () => {
  const hr = { role: "HR" };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.employee.findUnique.mockResolvedValue({ id: "person", status: "OFFBOARDED", firstName: "Ana", lastName: "Lopez" });
  });

  it("refuses a manager without changing the record", async () => {
    const result = await saveRehireEligibility("person", { eligible: false, notes: "No call no show" }, { role: "MANAGER" });

    expect(result.ok).toBe(false);
    expect(mocks.employee.update).not.toHaveBeenCalled();
  });

  it("records the decision and the reason for a former employee", async () => {
    const result = await saveRehireEligibility("person", { eligible: false, notes: "  No call no show  " }, hr);

    expect(result.ok).toBe(true);
    expect(mocks.employee.update).toHaveBeenCalledWith({
      where: { id: "person" },
      data: { rehireEligible: false, rehireNotes: "No call no show" },
    });
  });

  it("stores an empty reason as no reason", async () => {
    await saveRehireEligibility("person", { eligible: true, notes: "   " }, hr);

    expect(mocks.employee.update).toHaveBeenCalledWith({
      where: { id: "person" },
      data: { rehireEligible: true, rehireNotes: null },
    });
  });

  it("refuses to set it on someone who still works here", async () => {
    mocks.employee.findUnique.mockResolvedValue({ id: "person", status: "ACTIVE", firstName: "Ana", lastName: "Lopez" });

    const result = await saveRehireEligibility("person", { eligible: true }, hr);

    expect(result.ok).toBe(false);
    expect(mocks.employee.update).not.toHaveBeenCalled();
  });

  it("reports a person that does not exist", async () => {
    mocks.employee.findUnique.mockResolvedValue(null);

    const result = await saveRehireEligibility("missing", { eligible: true }, hr);

    expect(result.ok).toBe(false);
    expect(mocks.employee.update).not.toHaveBeenCalled();
  });
});
