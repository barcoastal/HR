import { describe, expect, it } from "vitest";
import { groupDocumentsByFolder, resolveDocumentVisibility } from "@/lib/document-folders";

describe("resolveDocumentVisibility", () => {
  it("keeps a medical document HR only even when employee access is requested", () => {
    expect(resolveDocumentVisibility("MEDICAL", "EVERYONE")).toBe("HR_ONLY");
  });

  it("lets a financial document be shared with the employee", () => {
    expect(resolveDocumentVisibility("FINANCIAL", "EVERYONE")).toBe("EVERYONE");
  });

  it("lets a non-medical document be restricted to HR", () => {
    expect(resolveDocumentVisibility("ONBOARDING", "HR_ONLY")).toBe("HR_ONLY");
  });
});

describe("groupDocumentsByFolder", () => {
  const documents = [
    { id: "w4", category: "FINANCIAL" },
    { id: "note", category: "MEDICAL" },
    { id: "contract", category: "ONBOARDING" },
    { id: "deposit", category: "FINANCIAL" },
  ];

  it("separates medical documents from stage and financial documents", () => {
    const folders = groupDocumentsByFolder(documents);

    expect(folders.map((folder) => [folder.key, folder.documents.map((document) => document.id)])).toEqual([
      ["ONBOARDING", ["contract"]],
      ["FINANCIAL", ["w4", "deposit"]],
      ["MEDICAL", ["note"]],
    ]);
  });

  it("leaves out folders that hold nothing", () => {
    const folders = groupDocumentsByFolder([{ id: "review", category: "REVIEW" }]);

    expect(folders.map((folder) => folder.key)).toEqual(["REVIEW"]);
  });

  it("names the stage-document folder for the people who use it", () => {
    const [folder] = groupDocumentsByFolder([{ id: "contract", category: "ONBOARDING" }]);

    expect(folder.label).toBe("Onboarding & stage documents");
  });
});
