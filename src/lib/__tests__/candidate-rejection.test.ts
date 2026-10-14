import { describe, expect, it } from "vitest";
import {
  REJECTION_REASONS,
  clearedRejectionIfLeaving,
  isRejectionReasonCode,
  rejectionReasonLabel,
  rejectionReasonsMatchingToken,
  resolveRejectionUpdate,
  validateRejection,
} from "@/lib/candidate-rejection";
import { sanitizeExportFilters } from "@/lib/import-export/export-registry";

describe("REJECTION_REASONS", () => {
  it("has the standard list with unique codes", () => {
    expect(REJECTION_REASONS.map((r) => r.label)).toEqual([
      "No-show",
      "Failed interview",
      "Withdrew",
      "Not qualified",
      "Salary mismatch",
      "Failed background check",
      "Went with another candidate",
      "No LinkedIn profile",
      "Other",
    ]);
    expect(new Set(REJECTION_REASONS.map((r) => r.code)).size).toBe(REJECTION_REASONS.length);
  });

  it("labels known codes and passes unknown ones through", () => {
    expect(rejectionReasonLabel("NO_LINKEDIN_PROFILE")).toBe("No LinkedIn profile");
    expect(rejectionReasonLabel("LEGACY_CODE")).toBe("LEGACY_CODE");
    expect(rejectionReasonLabel(null)).toBeNull();
    expect(isRejectionReasonCode("NO_SHOW")).toBe(true);
    expect(isRejectionReasonCode("nope")).toBe(false);
  });
});

describe("validateRejection", () => {
  it("requires a reason from the list", () => {
    expect(validateRejection(null).ok).toBe(false);
    expect(validateRejection({ reason: "" }).ok).toBe(false);
    expect(validateRejection({ reason: "MADE_UP" }).ok).toBe(false);
  });

  it("requires a note for Other only", () => {
    expect(validateRejection({ reason: "OTHER" }).ok).toBe(false);
    expect(validateRejection({ reason: "OTHER", note: "   " }).ok).toBe(false);
    expect(validateRejection({ reason: "OTHER", note: " Relocated " })).toEqual({
      ok: true,
      value: { reason: "OTHER", note: "Relocated" },
    });
    expect(validateRejection({ reason: "NO_SHOW" })).toEqual({ ok: true, value: { reason: "NO_SHOW", note: null } });
  });

  it("caps the note length", () => {
    expect(validateRejection({ reason: "WITHDREW", note: "x".repeat(501) }).ok).toBe(false);
  });
});

describe("resolveRejectionUpdate", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("blocks a move into REJECTED without a reason", () => {
    const r = resolveRejectionUpdate({ previousStatus: "INTERVIEW", nextStatus: "REJECTED", now });
    expect(r.ok).toBe(false);
  });

  it("stamps the reason when entering REJECTED", () => {
    const r = resolveRejectionUpdate({
      previousStatus: "INTERVIEW",
      nextStatus: "REJECTED",
      rejection: { reason: "FAILED_INTERVIEW" },
      now,
    });
    expect(r).toEqual({
      ok: true,
      reason: { reason: "FAILED_INTERVIEW", note: null },
      data: { rejectionReason: "FAILED_INTERVIEW", rejectionNote: null, rejectedAt: now },
    });
  });

  it("leaves an already-rejected candidate alone when no reason is given", () => {
    const r = resolveRejectionUpdate({ previousStatus: "REJECTED", nextStatus: "REJECTED", now });
    expect(r).toEqual({ ok: true, data: {}, reason: null });
  });

  it("updates the reason of an already-rejected candidate but keeps rejectedAt", () => {
    const earlier = new Date("2026-09-01T00:00:00Z");
    const r = resolveRejectionUpdate({
      previousStatus: "REJECTED",
      nextStatus: "REJECTED",
      rejection: { reason: "NO_LINKEDIN_PROFILE" },
      previousRejectedAt: earlier,
      now,
    });
    expect(r.ok && r.data.rejectedAt).toEqual(earlier);
  });

  it("clears the disposition when leaving REJECTED", () => {
    const r = resolveRejectionUpdate({ previousStatus: "REJECTED", nextStatus: "NEW", now });
    expect(r.ok && r.data).toEqual({ rejectionReason: null, rejectionNote: null, rejectedAt: null });
    expect(clearedRejectionIfLeaving("REJECTED")).toEqual({ rejectionReason: null, rejectionNote: null, rejectedAt: null });
    expect(clearedRejectionIfLeaving("NEW")).toEqual({});
  });

  it("does nothing for ordinary moves", () => {
    expect(resolveRejectionUpdate({ previousStatus: "NEW", nextStatus: "SCREENING", now })).toEqual({
      ok: true,
      data: {},
      reason: null,
    });
  });
});

describe("rejectionReasonsMatchingToken", () => {
  it("finds No LinkedIn profile from partial words", () => {
    expect(rejectionReasonsMatchingToken("linkedin")).toEqual(["NO_LINKEDIN_PROFILE"]);
    expect(rejectionReasonsMatchingToken("LinkedIn")).toEqual(["NO_LINKEDIN_PROFILE"]);
    expect(rejectionReasonsMatchingToken("no-show")).toEqual(["NO_SHOW"]);
    expect(rejectionReasonsMatchingToken("x")).toEqual([]);
  });
});

describe("candidate export filters", () => {
  it("accepts known rejection reasons and starred values only", () => {
    expect(
      sanitizeExportFilters("candidates", { rejectionReason: "NO_LINKEDIN_PROFILE", starred: "yes" }),
    ).toEqual({ rejectionReason: "NO_LINKEDIN_PROFILE", starred: "yes" });
    expect(sanitizeExportFilters("candidates", { rejectionReason: "DROP TABLE", starred: "maybe" })).toEqual({});
  });
});
