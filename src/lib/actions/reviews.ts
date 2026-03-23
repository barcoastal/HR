"use server";

import { db } from "@/lib/db";
import type { ReviewCycleStatus, ReviewType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getReviewCycles() {
  return db.reviewCycle.findMany({
    include: {
      reviews: {
        include: { employee: true, reviewer: true },
      },
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReviewCycle(id: string) {
  return db.reviewCycle.findUnique({
    where: { id },
    include: {
      reviews: {
        include: { employee: true, reviewer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createReviewCycle(data: {
  name: string;
  startDate: string;
  endDate: string;
  template?: unknown;
  selfTemplate?: unknown;
  managerTemplate?: unknown;
  peerTemplate?: unknown;
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  // Only SUPER_ADMIN and ADMIN can attach templates
  const canSetTemplate = role === "SUPER_ADMIN" || role === "ADMIN";

  const cycle = await db.reviewCycle.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: "DRAFT",
      ...(canSetTemplate && data.template ? { template: data.template } : {}),
      ...(canSetTemplate && data.selfTemplate ? { selfTemplate: data.selfTemplate } : {}),
      ...(canSetTemplate && data.managerTemplate ? { managerTemplate: data.managerTemplate } : {}),
      ...(canSetTemplate && data.peerTemplate ? { peerTemplate: data.peerTemplate } : {}),
    },
  });
  revalidatePath("/reviews");
  return cycle;
}

export async function updateReviewCycleStatus(
  cycleId: string,
  status: ReviewCycleStatus
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  const cycle = await db.reviewCycle.update({
    where: { id: cycleId },
    data: { status },
  });
  revalidatePath("/reviews");
  return cycle;
}

export async function deleteReviewCycle(cycleId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await db.reviewCycle.delete({ where: { id: cycleId } });
  revalidatePath("/reviews");
}

export async function addReviewToCycle(data: {
  cycleId: string;
  employeeId: string;
  reviewerId: string;
  type: ReviewType;
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  const review = await db.review.create({
    data: {
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: data.reviewerId,
      type: data.type,
    },
  });
  revalidatePath("/reviews");
  return review;
}

export async function submitReview(
  reviewId: string,
  data: {
    rating: number;
    strengths: string;
    improvements: string;
    goals: string;
  }
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;

  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("Review not found");

  // Only the assigned reviewer can submit, or admin/hr
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  if (review.reviewerId !== employeeId && !isAdmin) {
    throw new Error("Not authorized to submit this review");
  }

  const updated = await db.review.update({
    where: { id: reviewId },
    data: {
      rating: data.rating,
      strengths: data.strengths,
      improvements: data.improvements,
      goals: data.goals,
      status: "SUBMITTED",
    },
  });
  revalidatePath("/reviews");
  return updated;
}

export async function deleteReview(reviewId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await db.review.delete({ where: { id: reviewId } });
  revalidatePath("/reviews");
}

export async function getMyPendingReviews(employeeId: string) {
  return db.review.findMany({
    where: {
      reviewerId: employeeId,
      status: "PENDING",
      cycle: { status: "ACTIVE" },
    },
    include: {
      employee: true,
      cycle: true,
    },
  });
}

/**
 * Auto-generate SELF + MANAGER reviews for all active employees
 * in the given departments. Each employee gets a SELF review
 * (they review themselves) and a MANAGER review (their manager
 * reviews them). Employees without a manager only get SELF.
 */
export async function generateReviewsForCycle(
  cycleId: string,
  departmentIds: string[]
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  const employees = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      departmentId: { in: departmentIds },
    },
    select: { id: true, managerId: true },
  });

  // Get existing reviews in this cycle to avoid duplicates
  const existing = await db.review.findMany({
    where: { cycleId },
    select: { employeeId: true, type: true },
  });
  const existingSet = new Set(
    existing.map((r) => `${r.employeeId}:${r.type}`)
  );

  const reviewsToCreate: {
    cycleId: string;
    employeeId: string;
    reviewerId: string;
    type: "SELF" | "MANAGER";
  }[] = [];

  for (const emp of employees) {
    // Self review
    if (!existingSet.has(`${emp.id}:SELF`)) {
      reviewsToCreate.push({
        cycleId,
        employeeId: emp.id,
        reviewerId: emp.id,
        type: "SELF",
      });
    }
    // Manager review
    if (emp.managerId && !existingSet.has(`${emp.id}:MANAGER`)) {
      reviewsToCreate.push({
        cycleId,
        employeeId: emp.id,
        reviewerId: emp.managerId,
        type: "MANAGER",
      });
    }
  }

  if (reviewsToCreate.length > 0) {
    await db.review.createMany({ data: reviewsToCreate });
  }

  revalidatePath("/reviews");
  return { created: reviewsToCreate.length, employees: employees.length };
}
