import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeTask: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { employeeTask: mocks.employeeTask } }));
import { recordSentWrittenOfferDocument } from "@/lib/written-offer-sent-documents";

const compensationPlan = { name: "Customer Service Compensation Plan", url: "/api/onboarding-docs/plan.pdf" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.employeeTask.findFirst.mockResolvedValue(null);
});

describe("recordSentWrittenOfferDocument", () => {
  it("shows an emailed document on the Written Offer card as already sent", async () => {
    await recordSentWrittenOfferDocument("person", compensationPlan);

    expect(mocks.employeeTask.create).toHaveBeenCalledWith({
      data: {
        employeeId: "person",
        title: "Customer Service Compensation Plan",
        description: "Sent by email as an attachment. No signature required.",
        documentAction: "SEND",
        documentName: "Customer Service Compensation Plan",
        documentUrl: "/api/onboarding-docs/plan.pdf",
        status: "DONE",
        completedAt: expect.any(Date),
      },
    });
  });

  it("looks for an earlier record of the same document for the same person", async () => {
    await recordSentWrittenOfferDocument("person", compensationPlan);

    expect(mocks.employeeTask.findFirst).toHaveBeenCalledWith({
      where: { employeeId: "person", documentAction: "SEND", documentName: "Customer Service Compensation Plan", checklistItemId: null },
      select: { id: true },
    });
  });

  it("updates the existing record when the document is sent again instead of adding a second one", async () => {
    mocks.employeeTask.findFirst.mockResolvedValue({ id: "task-1" });

    await recordSentWrittenOfferDocument("person", compensationPlan);

    expect(mocks.employeeTask.create).not.toHaveBeenCalled();
    expect(mocks.employeeTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "DONE", completedAt: expect.any(Date), documentUrl: "/api/onboarding-docs/plan.pdf" },
    });
  });
});
