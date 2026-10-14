import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  getSession: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { document: mocks.document } }));
vi.mock("@/lib/auth-helpers", () => ({ getSession: mocks.getSession }));

import { isFileBlockedFor, isRestrictedFile } from "@/lib/restricted-files";
import { redactCandidateForViewer, redactNestedCandidatesForViewer } from "@/lib/background-checks/viewer-redaction";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.document.findFirst.mockResolvedValue(null);
});

describe("isRestrictedFile", () => {
  it("treats cached background-check reports as restricted without a lookup", async () => {
    expect(await isRestrictedFile({ filename: "bg-report-1-abc.pdf" })).toBe(true);
    expect(mocks.document.findFirst).not.toHaveBeenCalled();
  });

  it("looks for an I-9 / background-check Document pointing at the file", async () => {
    mocks.document.findFirst.mockResolvedValue({ id: "doc" });

    expect(await isRestrictedFile({ urls: ["/api/resumes/cand-1"] })).toBe(true);
    expect(mocks.document.findFirst).toHaveBeenCalledWith({
      where: {
        url: { in: ["/api/resumes/cand-1"] },
        OR: [{ visibility: "SUPER_ADMIN_ONLY" }, { category: { in: ["I9", "BACKGROUND_CHECK"] } }],
      },
      select: { id: true },
    });
  });

  it("is not restricted when no such Document exists", async () => {
    expect(await isRestrictedFile({ filename: "3f2a.pdf" })).toBe(false);
  });
});

describe("isFileBlockedFor", () => {
  it("never blocks a Super Admin", async () => {
    expect(await isFileBlockedFor("SUPER_ADMIN", { filename: "bg-report-1.pdf" })).toBe(false);
  });

  it("blocks restricted files for admins and HR", async () => {
    expect(await isFileBlockedFor("ADMIN", { filename: "bg-report-1.pdf" })).toBe(true);
    mocks.document.findFirst.mockResolvedValue({ id: "doc" });
    expect(await isFileBlockedFor("HR", { urls: ["/api/onboarding-docs/x.pdf"] })).toBe(true);
  });
});

describe("viewer redaction", () => {
  const candidate = { id: "c", backgroundCheckStatus: "PASSED", backgroundCheckId: "INV-1" };

  it("blanks background-check fields for non-super-admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "HR" } });
    expect(await redactCandidateForViewer(candidate)).toEqual({ id: "c", backgroundCheckStatus: null, backgroundCheckId: null });
    expect(await redactNestedCandidatesForViewer([{ id: "i", candidate }])).toEqual([
      { id: "i", candidate: { id: "c", backgroundCheckStatus: null, backgroundCheckId: null } },
    ]);
  });

  it("keeps them for Super Admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "SUPER_ADMIN" } });
    expect(await redactCandidateForViewer(candidate)).toBe(candidate);
  });
});
