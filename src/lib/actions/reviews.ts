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
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  const cycle = await db.reviewCycle.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: "DRAFT",
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
