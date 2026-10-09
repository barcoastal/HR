import { describe, expect, it } from "vitest";
import { attendeeResponses, googleStatusForAnswer, responseCounts, responseFromGoogle } from "@/lib/event-responses";

const invitees = [
  { email: "sandra@example.com", name: "Sandra Example" },
  { email: "Tatiana@Example.com", name: "Tatiana Example" },
  { email: "nobody@example.com", name: "Nobody Example" },
];

describe("attendeeResponses", () => {
  it("takes the answer off the Google event, ignoring email case", () => {
    const rows = attendeeResponses({
      invitees,
      googleAttendees: [
        { email: "sandra@example.com", responseStatus: "accepted" },
        { email: "tatiana@example.com", responseStatus: "declined" },
      ],
    });
    expect(rows.map((r) => [r.name, r.response])).toEqual([
      ["Sandra Example", "accepted"],
      ["Tatiana Example", "declined"],
      ["Nobody Example", "needsAction"],
    ]);
  });

  it("falls back to an in-app answer when Google has no response yet", () => {
    const rows = attendeeResponses({
      invitees,
      googleAttendees: [{ email: "sandra@example.com", responseStatus: "needsAction" }],
      inApp: { "sandra@example.com": "GOING", "tatiana@example.com": "NOT_GOING" },
    });
    expect(rows.map((r) => r.response)).toEqual(["accepted", "declined", "needsAction"]);
  });

  it("prefers the Google answer over a stale in-app one", () => {
    const rows = attendeeResponses({
      invitees: invitees.slice(0, 1),
      googleAttendees: [{ email: "sandra@example.com", responseStatus: "tentative" }],
      inApp: { "sandra@example.com": "GOING" },
    });
    expect(rows[0].response).toBe("tentative");
  });

  it("works without any Google event at all", () => {
    const rows = attendeeResponses({ invitees, googleAttendees: null, inApp: { "nobody@example.com": "MAYBE" } });
    expect(rows.map((r) => r.response)).toEqual(["needsAction", "needsAction", "tentative"]);
  });
});

describe("helpers", () => {
  it("narrows unknown Google statuses to needsAction", () => {
    expect(responseFromGoogle("accepted")).toBe("accepted");
    expect(responseFromGoogle("whatever")).toBe("needsAction");
    expect(responseFromGoogle(undefined)).toBe("needsAction");
  });

  it("maps in-app clicks onto Google statuses", () => {
    expect(googleStatusForAnswer("GOING")).toBe("accepted");
    expect(googleStatusForAnswer("MAYBE")).toBe("tentative");
    expect(googleStatusForAnswer("NOT_GOING")).toBe("declined");
  });

  it("counts responses", () => {
    const rows = attendeeResponses({
      invitees,
      googleAttendees: [{ email: "sandra@example.com", responseStatus: "accepted" }],
    });
    expect(responseCounts(rows)).toEqual({ accepted: 1, declined: 0, tentative: 0, needsAction: 2 });
  });
});
