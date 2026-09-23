import { describe, expect, it } from "vitest";
import { defaultWithMeet, resolveMeetLinkPolicy } from "@/lib/interview-meet-link";

describe("resolveMeetLinkPolicy", () => {
  it("creates a Meet link for a remote interview by default", () => {
    expect(resolveMeetLinkPolicy("VIDEO", undefined).createMeetLink).toBe(true);
  });

  it("skips the Meet link for a remote interview when the scheduler opts out", () => {
    expect(resolveMeetLinkPolicy("VIDEO", false).createMeetLink).toBe(false);
  });

  it("shares a remote interview's Meet link with the candidate", () => {
    expect(resolveMeetLinkPolicy("PHONE_SCREEN", true).shareMeetLinkWithCandidate).toBe(true);
  });

  it("skips the Meet link for an onsite interview by default", () => {
    expect(resolveMeetLinkPolicy("ONSITE", undefined).createMeetLink).toBe(false);
  });

  it("creates a Meet link for an onsite interview when the scheduler opts in", () => {
    expect(resolveMeetLinkPolicy("ONSITE", true).createMeetLink).toBe(true);
  });

  it("keeps an onsite interview's Meet link out of the candidate email", () => {
    expect(resolveMeetLinkPolicy("ONSITE", true).shareMeetLinkWithCandidate).toBe(false);
  });
});

describe("defaultWithMeet", () => {
  it("starts unchecked for onsite interviews", () => {
    expect(defaultWithMeet("ONSITE")).toBe(false);
  });

  it("starts checked for every remote interview type", () => {
    for (const type of ["PHONE_SCREEN", "VIDEO", "TECHNICAL", "BEHAVIORAL", "PANEL", "FINAL"] as const) {
      expect(defaultWithMeet(type)).toBe(true);
    }
  });
});
