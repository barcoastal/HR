import { describe, expect, it } from "vitest";
import { managerAssignmentError } from "@/lib/reporting-line";

// ceo <- director <- lead <- rep, and an unrelated peer under the ceo
const people = [
  { id: "ceo", managerId: null },
  { id: "director", managerId: "ceo" },
  { id: "lead", managerId: "director" },
  { id: "rep", managerId: "lead" },
  { id: "peer", managerId: "ceo" },
  { id: "newcomer", managerId: null },
];

describe("managerAssignmentError", () => {
  it("allows a manager for someone who has none", () => {
    expect(managerAssignmentError("newcomer", "lead", people)).toBeNull();
  });

  it("allows moving someone to a manager in another branch", () => {
    expect(managerAssignmentError("rep", "peer", people)).toBeNull();
  });

  it("allows moving someone directly under their manager's manager", () => {
    expect(managerAssignmentError("rep", "director", people)).toBeNull();
  });

  it("rejects making someone their own manager", () => {
    expect(managerAssignmentError("lead", "lead", people)).toMatch(/own manager/);
  });

  it("rejects a manager who reports directly to the person", () => {
    expect(managerAssignmentError("lead", "rep", people)).toMatch(/loop/);
  });

  it("rejects a manager who reports to the person through other people", () => {
    expect(managerAssignmentError("director", "rep", people)).toMatch(/loop/);
  });

  it("still answers when existing records already contain a loop", () => {
    const looped = [
      { id: "a", managerId: "b" },
      { id: "b", managerId: "a" },
      { id: "newcomer", managerId: null },
    ];

    expect(managerAssignmentError("newcomer", "a", looped)).toBeNull();
  });
});
