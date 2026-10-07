import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  candidate: { findFirst: vi.fn() },
  position: { findMany: vi.fn() },
  positionDocument: { findMany: vi.fn() },
  employee: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  db: {
    candidate: mocks.candidate,
    position: mocks.position,
    positionDocument: mocks.positionDocument,
    employee: mocks.employee,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getPositionDocumentsForEmployee,
  resolvePositionDocumentsForWrittenOffer,
} from "@/lib/actions/position-documents";

const compensationPlan = {
  id: "doc-1",
  name: "Customer Service Compensation Plan",
  pdfData: "JVBERi0x",
  placeholders: "[]",
  requiresSignature: false,
  requiresFill: false,
  requiresCountersignature: false,
  countersignerId: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.candidate.findFirst.mockResolvedValue(null);
  mocks.position.findMany.mockResolvedValue([]);
  mocks.positionDocument.findMany.mockResolvedValue([compensationPlan]);
});

describe("resolvePositionDocumentsForWrittenOffer", () => {
  it("loads documents for every Retention Specialist position, not only the hired req id", async () => {
    mocks.position.findMany.mockResolvedValue([{ id: "rs-old" }, { id: "rs-hired" }]);

    await resolvePositionDocumentsForWrittenOffer({
      positionId: "rs-hired",
      jobTitle: "Retention Specialist",
    });

    expect(mocks.position.findMany).toHaveBeenCalledWith({
      where: { title: { equals: "Retention Specialist", mode: "insensitive" } },
      select: { id: true },
    });
    expect(mocks.positionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { positionId: { in: expect.arrayContaining(["rs-hired", "rs-old"]) } },
      })
    );
  });

  it("dedupes the same document name across multiple Retention Specialist reqs", async () => {
    mocks.position.findMany.mockResolvedValue([{ id: "rs-a" }, { id: "rs-b" }]);
    mocks.positionDocument.findMany.mockResolvedValue([
      { ...compensationPlan, id: "doc-a" },
      { ...compensationPlan, id: "doc-b", name: "Customer Service Compensation Plan" },
    ]);

    const docs = await resolvePositionDocumentsForWrittenOffer({
      jobTitle: "Retention Specialist",
    });

    expect(docs).toHaveLength(1);
  });

  it("includes applications when the candidate's current positionId is empty", async () => {
    mocks.candidate.findFirst.mockResolvedValue({
      positionId: null,
      jobAppliedTo: "Retention Specialist",
      applications: [{ positionId: "rs-app" }],
    });
    mocks.position.findMany.mockResolvedValue([{ id: "rs-app" }]);

    await resolvePositionDocumentsForWrittenOffer({
      candidateEmail: "hire@example.com",
    });

    expect(mocks.positionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { positionId: { in: expect.arrayContaining(["rs-app"]) } },
      })
    );
  });
});

describe("getPositionDocumentsForEmployee", () => {
  it("matches position documents by the employee's job title when emails no longer match", async () => {
    mocks.employee.findUnique.mockResolvedValue({
      email: "first.last@coastaldebt.com",
      jobTitle: "Retention Specialist",
    });
    mocks.position.findMany.mockResolvedValue([{ id: "rs-1" }]);

    const docs = await getPositionDocumentsForEmployee("emp-1");

    expect(docs).toEqual([
      expect.objectContaining({
        id: "doc-1",
        name: "Customer Service Compensation Plan",
        hasPdf: true,
      }),
    ]);
    expect(mocks.position.findMany).toHaveBeenCalledWith({
      where: { title: { equals: "Retention Specialist", mode: "insensitive" } },
      select: { id: true },
    });
  });
});
