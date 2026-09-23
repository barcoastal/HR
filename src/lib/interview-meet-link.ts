import type { InterviewType } from "@/generated/prisma/client";

/**
 * Whether the "Create Google Meet link" box starts checked for a given type.
 * Remote interviews are held over Meet by default. Onsite interviews only
 * need one when part of the team is joining remotely, so it starts off.
 */
export function defaultWithMeet(type: InterviewType): boolean {
  return type !== "ONSITE";
}

export function resolveMeetLinkPolicy(
  type: InterviewType,
  withMeet: boolean | undefined
): {
  /** Attach a Google Meet conference to the calendar event. */
  createMeetLink: boolean;
  /**
   * Put the Join button in the candidate's invitation. Onsite candidates come
   * in person; their Meet link exists for remote team members and is surfaced
   * in the HR app and on the calendar event instead.
   */
  shareMeetLinkWithCandidate: boolean;
} {
  if (type === "ONSITE") {
    return { createMeetLink: withMeet === true, shareMeetLinkWithCandidate: false };
  }
  return { createMeetLink: withMeet !== false, shareMeetLinkWithCandidate: true };
}
