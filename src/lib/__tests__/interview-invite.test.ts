import { describe, expect, it } from "vitest";
import { candidateRsvp, inviteDelivery, RSVP_LABEL } from "@/lib/interview-invite";

describe("candidateRsvp", () => {
  const attendees = [
    { email: "recruiter@corp.com", responseStatus: "accepted", organizer: true },
    { email: "Sam.Candidate@gmail.com", responseStatus: "tentative" },
  ];

  it("reads the candidate's Google response, matching the email case-insensitively", () => {
    expect(candidateRsvp(attendees, "sam.candidate@gmail.com")).toBe("tentative");
  });

  it("returns null when the candidate is not on the event or the event has no attendees", () => {
    expect(candidateRsvp(attendees, "other@gmail.com")).toBeNull();
    expect(candidateRsvp(undefined, "sam.candidate@gmail.com")).toBeNull();
  });

  it("treats an unknown Google status as no response yet", () => {
    expect(candidateRsvp([{ email: "a@b.com", responseStatus: "weird" }], "a@b.com")).toBe("needsAction");
    expect(candidateRsvp([{ email: "a@b.com" }], "a@b.com")).toBe("needsAction");
  });

  it("has a label for every status", () => {
    expect(RSVP_LABEL).toEqual({ accepted: "Accepted", declined: "Declined", tentative: "Maybe", needsAction: "No response yet" });
  });
});

describe("inviteDelivery", () => {
  it("lets Google carry the invitation when a calendar event exists, so the email gets no .ics", () => {
    const d = inviteDelivery(true);
    expect(d.attachIcs).toBe(false);
    expect(d.candidateNote).toMatch(/Google Calendar invitation/);
    expect(d.candidateNote).toMatch(/accept/i);
  });

  it("falls back to the .ics attachment when no calendar event could be created", () => {
    const d = inviteDelivery(false);
    expect(d.attachIcs).toBe(true);
    expect(d.candidateNote).toMatch(/attached/);
  });
});
