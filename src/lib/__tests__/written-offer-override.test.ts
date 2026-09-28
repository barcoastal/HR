import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employee: { findUnique: vi.fn() },
  employeeTask: { findMany: vi.fn(), updateMany: vi.fn() },
  signingRequest: { findMany: vi.fn(), updateMany: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    employee: mocks.employee,
    employeeTask: mocks.employeeTask,
    signingRequest: mocks.signingRequest,
    $transaction: mocks.transaction,
  },
}));
import {
  applyWrittenOfferPushThrough,
  planWrittenOfferPushThrough,
  type WrittenOfferDocumentTask,
  type WrittenOfferStandaloneRequest,
} from "@/lib/written-offer-override";

const employeeCreatedAt = new Date("2026-09-01T12:00:00Z");

function documentTask(overrides: Partial<WrittenOfferDocumentTask> = {}): WrittenOfferDocumentTask {
  return {
    id: "task-1",
    status: "PENDING",
    title: "Sign the offer letter",
    documentAction: "SIGN",
    documentName: "Offer Letter.pdf",
    signingRequest: { id: "request-1", status: "PENDING" },
    ...overrides,
  };
}

function standaloneRequest(overrides: Partial<WrittenOfferStandaloneRequest> = {}): WrittenOfferStandaloneRequest {
  return {
    id: "standalone-1",
    status: "PENDING",
    documentName: "Direct Deposit Form.pdf",
    createdAt: new Date("2026-09-02T12:00:00Z"),
    ...overrides,
  };
}

function plan(tasks: WrittenOfferDocumentTask[], standaloneRequests: WrittenOfferStandaloneRequest[] = []) {
  return planWrittenOfferPushThrough({ employeeCreatedAt, tasks, standaloneRequests });
}

describe("planWrittenOfferPushThrough", () => {
  it("completes a document the candidate has not signed", () => {
    expect(plan([documentTask()]).taskIdsToComplete).toEqual(["task-1"]);
  });

  it("completes a document the candidate has not filled", () => {
    expect(plan([documentTask({ documentAction: "FILL" })]).taskIdsToComplete).toEqual(["task-1"]);
  });

  it("leaves a document that is already complete untouched", () => {
    const completed = documentTask({ status: "DONE", signingRequest: { id: "request-1", status: "SIGNED" } });

    expect(plan([completed])).toEqual({
      taskIdsToComplete: [],
      signingRequestIdsToVoid: [],
      outstandingDocuments: [],
    });
  });

  it("leaves checklist tasks that are not documents for the normal flow", () => {
    const tasks = [
      documentTask({ id: "task-none", documentAction: "NONE", signingRequest: null }),
      documentTask({ id: "task-send", documentAction: "SEND", signingRequest: null }),
      documentTask({ id: "task-custom", documentAction: null, signingRequest: null }),
    ];

    expect(plan(tasks).taskIdsToComplete).toEqual([]);
  });

  it("cancels the open signing link of a document it completes", () => {
    expect(plan([documentTask()]).signingRequestIdsToVoid).toEqual(["request-1"]);
  });

  it("cancels a signing link the candidate opened but never signed", () => {
    const viewed = documentTask({ signingRequest: { id: "request-1", status: "VIEWED" } });

    expect(plan([viewed]).signingRequestIdsToVoid).toEqual(["request-1"]);
  });

  it("completes a document that never had a signing link", () => {
    const result = plan([documentTask({ signingRequest: null })]);

    expect(result.taskIdsToComplete).toEqual(["task-1"]);
    expect(result.signingRequestIdsToVoid).toEqual([]);
  });

  it("keeps the link of a document waiting on a countersignature", () => {
    const awaiting = documentTask({ signingRequest: { id: "request-1", status: "AWAITING_COUNTERSIGN" } });

    expect(plan([awaiting])).toEqual({
      taskIdsToComplete: ["task-1"],
      signingRequestIdsToVoid: [],
      outstandingDocuments: [{ name: "Offer Letter.pdf", awaitingCountersign: true }],
    });
  });

  it("cancels a standalone signing request that is still open", () => {
    expect(plan([], [standaloneRequest()])).toEqual({
      taskIdsToComplete: [],
      signingRequestIdsToVoid: ["standalone-1"],
      outstandingDocuments: [{ name: "Direct Deposit Form.pdf", awaitingCountersign: false }],
    });
  });

  it("keeps a standalone request waiting on a countersignature", () => {
    const result = plan([], [standaloneRequest({ status: "AWAITING_COUNTERSIGN" })]);

    expect(result.signingRequestIdsToVoid).toEqual([]);
    expect(result.outstandingDocuments).toEqual([{ name: "Direct Deposit Form.pdf", awaitingCountersign: true }]);
  });

  it("ignores a standalone request that is already signed", () => {
    expect(plan([], [standaloneRequest({ status: "SIGNED" })]).outstandingDocuments).toEqual([]);
  });

  it("ignores a standalone request that was already cancelled", () => {
    const result = plan([], [standaloneRequest({ status: "VOIDED" })]);

    expect(result.signingRequestIdsToVoid).toEqual([]);
    expect(result.outstandingDocuments).toEqual([]);
  });

  it("ignores a standalone request sent before this person's record existed", () => {
    const earlier = standaloneRequest({ createdAt: new Date("2026-08-31T12:00:00Z") });

    expect(plan([], [earlier]).signingRequestIdsToVoid).toEqual([]);
  });

  it("counts a standalone request created at the same moment as the person's record", () => {
    const sameMoment = standaloneRequest({ createdAt: new Date("2026-09-01T12:00:00Z") });

    expect(plan([], [sameMoment]).signingRequestIdsToVoid).toEqual(["standalone-1"]);
  });

  it("lists every outstanding document by file name", () => {
    const tasks = [
      documentTask({ id: "task-1", documentName: "Offer Letter.pdf" }),
      documentTask({ id: "task-2", documentAction: "FILL", documentName: "W-4.pdf", signingRequest: { id: "request-2", status: "VIEWED" } }),
      documentTask({ id: "task-3", status: "DONE", documentName: "NDA.pdf", signingRequest: { id: "request-3", status: "SIGNED" } }),
    ];

    expect(plan(tasks, [standaloneRequest()]).outstandingDocuments).toEqual([
      { name: "Offer Letter.pdf", awaitingCountersign: false },
      { name: "W-4.pdf", awaitingCountersign: false },
      { name: "Direct Deposit Form.pdf", awaitingCountersign: false },
    ]);
  });

  it("falls back to the task title when the document has no file name", () => {
    const untitled = documentTask({ documentName: null });

    expect(plan([untitled]).outstandingDocuments).toEqual([
      { name: "Sign the offer letter", awaitingCountersign: false },
    ]);
  });
});

describe("applyWrittenOfferPushThrough", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (work) => work(mocks));
    mocks.employee.findUnique.mockResolvedValue({ status: "PRE_ONBOARDING", createdAt: employeeCreatedAt });
    mocks.employeeTask.findMany.mockResolvedValue([documentTask()]);
    mocks.signingRequest.findMany.mockResolvedValue([standaloneRequest()]);
  });

  it("refuses someone who has already left Written Offer and changes nothing", async () => {
    mocks.employee.findUnique.mockResolvedValue({ status: "ONBOARDING", createdAt: employeeCreatedAt });

    await expect(applyWrittenOfferPushThrough("person", "admin-employee")).rejects.toThrow(
      "This person is no longer in Written Offer."
    );
    expect(mocks.employeeTask.updateMany).not.toHaveBeenCalled();
    expect(mocks.signingRequest.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a person that does not exist", async () => {
    mocks.employee.findUnique.mockResolvedValue(null);

    await expect(applyWrittenOfferPushThrough("missing", "admin-employee")).rejects.toThrow("Employee not found");
    expect(mocks.employeeTask.updateMany).not.toHaveBeenCalled();
  });

  it("records who confirmed the outstanding documents", async () => {
    await applyWrittenOfferPushThrough("person", "admin-employee");

    expect(mocks.employeeTask.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-1"] }, status: { not: "DONE" } },
      data: { status: "DONE", completedAt: expect.any(Date), completedById: "admin-employee" },
    });
  });

  it("cancels the signing links only while they are still open", async () => {
    await applyWrittenOfferPushThrough("person", "admin-employee");

    expect(mocks.signingRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["request-1", "standalone-1"] }, status: { in: ["PENDING", "VIEWED"] } },
      data: { status: "VOIDED", expiresAt: expect.any(Date) },
    });
  });

  it("reports the documents it confirmed", async () => {
    const result = await applyWrittenOfferPushThrough("person", "admin-employee");

    expect(result.outstandingDocuments).toEqual([
      { name: "Offer Letter.pdf", awaitingCountersign: false },
      { name: "Direct Deposit Form.pdf", awaitingCountersign: false },
    ]);
  });

  it("writes nothing when no document is outstanding", async () => {
    mocks.employeeTask.findMany.mockResolvedValue([]);
    mocks.signingRequest.findMany.mockResolvedValue([]);

    const result = await applyWrittenOfferPushThrough("person", "admin-employee");

    expect(result.outstandingDocuments).toEqual([]);
    expect(mocks.employeeTask.updateMany).not.toHaveBeenCalled();
    expect(mocks.signingRequest.updateMany).not.toHaveBeenCalled();
  });
});
