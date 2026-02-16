"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getTimeOffPolicies() {
  return db.timeOffPolicy.findMany({ orderBy: { name: "asc" } });
}

export async function createTimeOffPolicy(data: {
  name: string;
  daysPerYear: number;
  isUnlimited: boolean;
}) {
  const policy = await db.timeOffPolicy.create({ data });
  revalidatePath("/settings");
  revalidatePath("/time-off");
  return policy;
}

export async function deleteTimeOffPolicy(id: string) {
  await db.timeOffPolicy.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/time-off");
}

export async function assignPolicyToEmployee(
  employeeId: string,
  policyId: string,
  year: number
) {
  const balance = await db.timeOffBalance.upsert({
    where: {
      employeeId_policyId_year: { employeeId, policyId, year },
    },
    update: {},
    create: { employeeId, policyId, year, used: 0 },
  });
  revalidatePath("/time-off");
  return balance;
}

export async function getEmployeeBalances(employeeId: string, year: number) {
  return db.timeOffBalance.findMany({
    where: { employeeId, year },
    include: { policy: true },
  });
}

export async function createTimeOffRequest(data: {
  employeeId: string;
  policyId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
}) {
  const request = await db.timeOffRequest.create({
    data: {
      employeeId: data.employeeId,
      policyId: data.policyId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      daysCount: data.daysCount,
      reason: data.reason || null,
    },
  });
  revalidatePath("/time-off");
  return request;
}

export async function approveTimeOffRequest(
  requestId: string,
  approverId: string
) {
  const request = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", approverId },
  });

  // Update balance
  const year = request.startDate.getFullYear();
  await db.timeOffBalance.upsert({
    where: {
      employeeId_policyId_year: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year,
      },
    },
    update: { used: { increment: request.daysCount } },
    create: {
      employeeId: request.employeeId,
      policyId: request.policyId,
      year,
      used: request.daysCount,
    },
  });

  revalidatePath("/time-off");
  return request;
}

export async function denyTimeOffRequest(
  requestId: string,
  approverId: string
) {
  const request = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "DENIED", approverId },
  });
  revalidatePath("/time-off");
  return request;
}

export async function cancelTimeOffRequest(requestId: string) {
  const request = await db.timeOffRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return null;

  // If it was approved, refund the balance
  if (request.status === "APPROVED") {
    const year = request.startDate.getFullYear();
    await db.timeOffBalance.update({
      where: {
        employeeId_policyId_year: {
          employeeId: request.employeeId,
          policyId: request.policyId,
          year,
        },
      },
      data: { used: { decrement: request.daysCount } },
    });
  }

  const updated = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/time-off");
  return updated;
}

export async function getTimeOffRequests(filters?: {
  employeeId?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.employeeId) where.employeeId = filters.employeeId;
  if (filters?.status) where.status = filters.status;

  return db.timeOffRequest.findMany({
    where,
    include: {
      employee: true,
      policy: true,
      approver: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWhosOutToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return db.timeOffRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: tomorrow },
      endDate: { gte: today },
    },
    include: { employee: true, policy: true },
  });
}

export async function getTeamCalendar(year: number, month: number) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return db.timeOffRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: { employee: true, policy: true },
    orderBy: { startDate: "asc" },
  });
}

export async function getBurnoutAlerts() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const allActive = await db.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      timeOffRequests: {
        where: { status: "APPROVED" },
        orderBy: { endDate: "desc" },
        take: 1,
      },
    },
  });

  return allActive.filter((emp) => {
    if (emp.timeOffRequests.length === 0) return true;
    return emp.timeOffRequests[0].endDate < sixMonthsAgo;
  });
}
