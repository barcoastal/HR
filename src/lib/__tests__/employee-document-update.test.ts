import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { document: mocks.document } }));
import { restrictAllDocumentsToHr, updateDocumentSettings } from "@/lib/employee-document-update";

const hr = { role: "HR" };
const manager = { role: "MANAGER" };
const contract = { id: "doc-1", employeeId: "person", name: "Contract.pdf", category: "ONBOARDING", visibility: "EVERYONE" };
const doctorsNote = { id: "doc-2", employeeId: "person", name: "Doctor note.pdf", category: "MEDICAL", visibility: "HR_ONLY" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.document.findUnique.mockResolvedValue(contract);
  mocks.document.updateMany.mockResolvedValue({ count: 0 });
});

describe("updateDocumentSettings", () => {
  it("refuses anyone outside HR and admin without changing the document", async () => {
    const result = await updateDocumentSettings("doc-1", { visibility: "HR_ONLY" }, manager);

    expect(result.ok).toBe(false);
    expect(mocks.document.update).not.toHaveBeenCalled();
  });

  it("hides a document from the employee without moving it", async () => {
    const result = await updateDocumentSettings("doc-1", { visibility: "HR_ONLY" }, hr);

    expect(result.ok).toBe(true);
    expect(mocks.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { category: "ONBOARDING", visibility: "HR_ONLY" },
    });
  });

  it("makes a document HR only when it is moved into Medical", async () => {
    await updateDocumentSettings("doc-1", { category: "MEDICAL" }, hr);

    expect(mocks.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { category: "MEDICAL", visibility: "HR_ONLY" },
    });
  });

  it("refuses to share a medical document with the employee", async () => {
    mocks.document.findUnique.mockResolvedValue(doctorsNote);

    const result = await updateDocumentSettings("doc-2", { visibility: "EVERYONE" }, hr);

    expect(result.ok).toBe(false);
    expect(mocks.document.update).not.toHaveBeenCalled();
  });

  it("keeps a document HR only when it is moved out of Medical", async () => {
    mocks.document.findUnique.mockResolvedValue(doctorsNote);

    await updateDocumentSettings("doc-2", { category: "GENERAL" }, hr);

    expect(mocks.document.update).toHaveBeenCalledWith({
      where: { id: "doc-2" },
      data: { category: "GENERAL", visibility: "HR_ONLY" },
    });
  });

  it("reports a document that no longer exists", async () => {
    mocks.document.findUnique.mockResolvedValue(null);

    const result = await updateDocumentSettings("gone", { visibility: "HR_ONLY" }, hr);

    expect(result.ok).toBe(false);
    expect(mocks.document.update).not.toHaveBeenCalled();
  });
});

describe("restrictAllDocumentsToHr", () => {
  it("refuses anyone outside HR and admin without changing anything", async () => {
    const result = await restrictAllDocumentsToHr("person", manager);

    expect(result.ok).toBe(false);
    expect(mocks.document.updateMany).not.toHaveBeenCalled();
  });

  it("hides only that person's documents that the employee can currently see", async () => {
    mocks.document.updateMany.mockResolvedValue({ count: 4 });

    const result = await restrictAllDocumentsToHr("person", hr);

    expect(result).toEqual({ ok: true, changed: 4 });
    expect(mocks.document.updateMany).toHaveBeenCalledWith({
      where: { employeeId: "person", visibility: "EVERYONE" },
      data: { visibility: "HR_ONLY" },
    });
  });
});
