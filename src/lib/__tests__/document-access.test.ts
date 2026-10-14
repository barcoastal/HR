import { describe, expect, it } from "vitest";
import {
  canViewBackgroundChecks,
  canViewDocument,
  isBackgroundReportFilename,
  redactBackgroundCheck,
  visibleDocumentsWhere,
} from "@/lib/document-access";
import { documentFoldersFor, resolveDocumentVisibility } from "@/lib/document-folders";
import { sortI9Rows, summarizeI9Coverage } from "@/lib/compliance";

const owner = "emp-owner";
const boss = "emp-manager";
const i9 = { category: "I9", visibility: "SUPER_ADMIN_ONLY", employeeId: owner, managerId: boss };
const bgDoc = { category: "BACKGROUND_CHECK", visibility: "SUPER_ADMIN_ONLY", employeeId: owner, managerId: boss };
const contract = { category: "ONBOARDING", visibility: "EVERYONE", employeeId: owner, managerId: boss };
const hrNote = { category: "GENERAL", visibility: "HR_ONLY", employeeId: owner, managerId: boss };

describe("canViewDocument", () => {
  it("lets only a Super Admin open an I-9 or background check", () => {
    expect(canViewDocument({ role: "SUPER_ADMIN" }, i9)).toBe(true);
    expect(canViewDocument({ role: "SUPER_ADMIN" }, bgDoc)).toBe(true);
    for (const role of ["ADMIN", "HR", "MANAGER", "EMPLOYEE"]) {
      expect(canViewDocument({ role }, i9)).toBe(false);
      expect(canViewDocument({ role }, bgDoc)).toBe(false);
    }
  });

  it("hides an I-9 from the employee it belongs to and their manager", () => {
    expect(canViewDocument({ role: "EMPLOYEE", employeeId: owner }, i9)).toBe(false);
    expect(canViewDocument({ role: "MANAGER", employeeId: boss }, i9)).toBe(false);
  });

  it("treats a restricted folder as Super Admin only even if the stored visibility is wrong", () => {
    expect(canViewDocument({ role: "HR" }, { ...i9, visibility: "EVERYONE" })).toBe(false);
    expect(canViewDocument({ role: "HR" }, { ...contract, visibility: "SUPER_ADMIN_ONLY" })).toBe(false);
  });

  it("keeps the existing HR-only and owner/manager rules", () => {
    expect(canViewDocument({ role: "HR" }, hrNote)).toBe(true);
    expect(canViewDocument({ role: "EMPLOYEE", employeeId: owner }, hrNote)).toBe(false);
    expect(canViewDocument({ role: "EMPLOYEE", employeeId: owner }, contract)).toBe(true);
    expect(canViewDocument({ role: "MANAGER", employeeId: boss }, contract)).toBe(true);
    expect(canViewDocument({ role: "EMPLOYEE", employeeId: "someone-else" }, contract)).toBe(false);
    expect(canViewDocument(null, contract)).toBe(false);
  });
});

describe("visibleDocumentsWhere", () => {
  it("does not filter for Super Admins", () => {
    expect(visibleDocumentsWhere("SUPER_ADMIN")).toEqual({});
  });

  it("excludes I-9s and background checks for admins and HR", () => {
    for (const role of ["ADMIN", "HR"]) {
      expect(visibleDocumentsWhere(role)).toEqual({
        category: { notIn: ["I9", "BACKGROUND_CHECK"] },
        visibility: { in: ["EVERYONE", "HR_ONLY"] },
      });
    }
  });

  it("only shows shared, non-restricted documents to managers and employees", () => {
    for (const role of ["MANAGER", "EMPLOYEE", undefined]) {
      expect(visibleDocumentsWhere(role)).toEqual({
        category: { notIn: ["I9", "BACKGROUND_CHECK"] },
        visibility: "EVERYONE",
      });
    }
  });
});

describe("resolveDocumentVisibility", () => {
  it("forces I-9 and background-check folders to Super Admin only", () => {
    expect(resolveDocumentVisibility("I9", "EVERYONE")).toBe("SUPER_ADMIN_ONLY");
    expect(resolveDocumentVisibility("BACKGROUND_CHECK", "HR_ONLY")).toBe("SUPER_ADMIN_ONLY");
  });

  it("falls back to HR only when a document leaves a Super Admin folder", () => {
    expect(resolveDocumentVisibility("GENERAL", "SUPER_ADMIN_ONLY")).toBe("HR_ONLY");
  });
});

describe("documentFoldersFor", () => {
  it("offers the I-9 and Background check folders to Super Admins only", () => {
    const keys = (role: string) => documentFoldersFor(role).map((f) => f.key);
    expect(keys("SUPER_ADMIN")).toEqual(expect.arrayContaining(["I9", "BACKGROUND_CHECK"]));
    expect(keys("HR")).not.toContain("I9");
    expect(keys("ADMIN")).not.toContain("BACKGROUND_CHECK");
  });
});

describe("background-check access", () => {
  const candidate = {
    id: "cand-1",
    status: "BACKGROUND_CHECK",
    backgroundCheckStatus: "FAILED",
    backgroundCheckId: "12345",
    backgroundCheckOptions: "{}",
    backgroundReportFilename: "bg-report-12345-abc.pdf",
    preAdverseActionStatus: "SENT",
    adverseActionLetterSentAt: new Date("2026-01-01"),
  };

  it("is Super Admin only", () => {
    expect(canViewBackgroundChecks("SUPER_ADMIN")).toBe(true);
    expect(canViewBackgroundChecks("ADMIN")).toBe(false);
    expect(canViewBackgroundChecks("HR")).toBe(false);
  });

  it("blanks results for everyone else but keeps the pipeline stage", () => {
    const redacted = redactBackgroundCheck(candidate, "HR");
    expect(redacted.status).toBe("BACKGROUND_CHECK");
    expect(redacted.backgroundCheckStatus).toBeNull();
    expect(redacted.backgroundCheckId).toBeNull();
    expect(redacted.backgroundReportFilename).toBeNull();
    expect(redacted.preAdverseActionStatus).toBeNull();
    expect(redacted.adverseActionLetterSentAt).toBeNull();
    expect(candidate.backgroundCheckStatus).toBe("FAILED");
  });

  it("leaves the record intact for a Super Admin", () => {
    expect(redactBackgroundCheck(candidate, "SUPER_ADMIN")).toBe(candidate);
  });

  it("recognises cached report PDFs", () => {
    expect(isBackgroundReportFilename("bg-report-12345-abc.pdf")).toBe(true);
    expect(isBackgroundReportFilename("3f2a-uuid.pdf")).toBe(false);
  });
});

describe("I-9 coverage", () => {
  const rows = [
    { name: "Zed Example", documents: [{ id: "d1" }] },
    { name: "Amy Example", documents: [] },
    { name: "Bob Example", documents: [{ id: "d2" }] },
  ];

  it("counts employees missing an I-9", () => {
    expect(summarizeI9Coverage(rows)).toEqual({ missing: 1, total: 3 });
  });

  it("lists people missing an I-9 first", () => {
    expect(sortI9Rows(rows).map((r) => r.name)).toEqual(["Amy Example", "Bob Example", "Zed Example"]);
  });
});
