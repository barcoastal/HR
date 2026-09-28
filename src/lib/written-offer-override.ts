import { db } from "@/lib/db";

export type WrittenOfferDocumentTask = {
  id: string;
  status: string;
  title: string | null;
  documentAction: string | null;
  documentName: string | null;
  signingRequest: { id: string; status: string } | null;
};

export type WrittenOfferStandaloneRequest = {
  id: string;
  status: string;
  documentName: string;
  createdAt: Date;
};

export type OutstandingDocument = {
  name: string;
  /**
   * The recipient already signed in the system and only the countersignature
   * is missing, so the request is kept instead of cancelled.
   */
  awaitingCountersign: boolean;
};

export type WrittenOfferPushThroughPlan = {
  taskIdsToComplete: string[];
  signingRequestIdsToVoid: string[];
  outstandingDocuments: OutstandingDocument[];
};

const OPEN_LINK_STATUSES = ["PENDING", "VIEWED"];

/**
 * Work out what a manual push-through has to change when signed copies were
 * collected outside the system. Covers the same documents that hold a person
 * in Written Offer: unfinished sign/fill tasks and standalone signing requests
 * sent since their record was created.
 */
export function planWrittenOfferPushThrough({
  employeeCreatedAt,
  tasks,
  standaloneRequests,
}: {
  employeeCreatedAt: Date;
  tasks: WrittenOfferDocumentTask[];
  standaloneRequests: WrittenOfferStandaloneRequest[];
}): WrittenOfferPushThroughPlan {
  const plan: WrittenOfferPushThroughPlan = {
    taskIdsToComplete: [],
    signingRequestIdsToVoid: [],
    outstandingDocuments: [],
  };

  for (const task of tasks) {
    const isDocument = task.documentAction === "SIGN" || task.documentAction === "FILL";
    if (!isDocument || task.status === "DONE") continue;

    plan.taskIdsToComplete.push(task.id);
    if (task.signingRequest && OPEN_LINK_STATUSES.includes(task.signingRequest.status)) {
      plan.signingRequestIdsToVoid.push(task.signingRequest.id);
    }
    plan.outstandingDocuments.push({
      name: task.documentName || task.title || "Untitled document",
      awaitingCountersign: task.signingRequest?.status === "AWAITING_COUNTERSIGN",
    });
  }

  for (const request of standaloneRequests) {
    if (request.createdAt < employeeCreatedAt) continue;
    if (request.status === "SIGNED" || request.status === "VOIDED") continue;

    if (OPEN_LINK_STATUSES.includes(request.status)) {
      plan.signingRequestIdsToVoid.push(request.id);
    }
    plan.outstandingDocuments.push({
      name: request.documentName,
      awaitingCountersign: request.status === "AWAITING_COUNTERSIGN",
    });
  }

  return plan;
}

/**
 * Mark a Written Offer person's outstanding documents as received outside the
 * system and cancel their open signing links. The status guards on each write
 * keep a document the recipient signs at the same moment from being overwritten.
 */
export async function applyWrittenOfferPushThrough(
  employeeId: string,
  completedById: string | null
): Promise<WrittenOfferPushThroughPlan> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, createdAt: true },
  });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "PRE_ONBOARDING") throw new Error("This person is no longer in Written Offer.");

  const [tasks, standaloneRequests] = await Promise.all([
    db.employeeTask.findMany({
      where: { employeeId, documentAction: { in: ["SIGN", "FILL"] } },
      select: {
        id: true,
        status: true,
        title: true,
        documentAction: true,
        documentName: true,
        signingRequest: { select: { id: true, status: true } },
      },
    }),
    db.signingRequest.findMany({
      where: {
        employeeId,
        employeeTaskId: null,
        createdAt: { gte: employee.createdAt },
        status: { not: "VOIDED" },
      },
      select: { id: true, status: true, documentName: true, createdAt: true },
    }),
  ]);

  const plan = planWrittenOfferPushThrough({ employeeCreatedAt: employee.createdAt, tasks, standaloneRequests });
  if (plan.taskIdsToComplete.length === 0 && plan.signingRequestIdsToVoid.length === 0) return plan;

  const now = new Date();
  await db.$transaction(async (tx) => {
    if (plan.taskIdsToComplete.length > 0) {
      await tx.employeeTask.updateMany({
        where: { id: { in: plan.taskIdsToComplete }, status: { not: "DONE" } },
        data: { status: "DONE", completedAt: now, completedById },
      });
    }
    if (plan.signingRequestIdsToVoid.length > 0) {
      await tx.signingRequest.updateMany({
        where: { id: { in: plan.signingRequestIdsToVoid }, status: { in: OPEN_LINK_STATUSES } },
        data: { status: "VOIDED", expiresAt: now },
      });
    }
  });

  return plan;
}
