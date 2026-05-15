"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

type Role = "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE" | undefined;

function isAdminRole(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

async function assertAdmin() {
  const session = await requireAuth();
  if (!isAdminRole(session.user?.role)) {
    throw new Error("Not authorized");
  }
  return session;
}

async function assertCanApprove(requestId: string) {
  const session = await requireAuth();
  const role = session.user?.role;
  const callerEmployeeId = session.user?.employeeId;
  const request = await db.timeOffRequest.findUnique({
    where: { id: requestId },
    select: { employeeId: true, employee: { select: { managerId: true } } },
  });
  if (!request) throw new Error("Request not found");

  // Employees can never approve their own requests
  if (request.employeeId === callerEmployeeId) {
    throw new Error("You cannot approve your own time-off request");
  }
  const isManager = !!callerEmployeeId && request.employee.managerId === callerEmployeeId;
  if (!isAdminRole(role) && !isManager) {
    throw new Error("Not authorized to approve this request");
  }
  return { session, callerEmployeeId: callerEmployeeId! };
}

export async function getTimeOffPolicies() {
  await requireAuth();
  return db.timeOffPolicy.findMany({ orderBy: { name: "asc" } });
}

export async function createTimeOffPolicy(data: {
  name: string;
  daysPerYear: number;
  isUnlimited: boolean;
  documentUrl?: string;
  documentName?: string;
}) {
  await assertAdmin();
  const policy = await db.timeOffPolicy.create({ data });
  revalidatePath("/settings");
  revalidatePath("/time-off");
  return policy;
}

export async function updateTimeOffPolicy(
  id: string,
  data: { documentUrl?: string | null; documentName?: string | null }
) {
  await assertAdmin();
  const policy = await db.timeOffPolicy.update({ where: { id }, data });
  revalidatePath("/settings");
  revalidatePath("/time-off");
  return policy;
}

export async function deleteTimeOffPolicy(id: string) {
  await assertAdmin();
  await db.timeOffPolicy.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/time-off");
}

export async function assignPolicyToEmployee(
  employeeId: string,
  policyId: string,
  year: number
) {
  await assertAdmin();
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
  const session = await requireAuth();
  const callerEmployeeId = session.user?.employeeId;
  const isAdmin = isAdminRole(session.user?.role);
  const isSelf = callerEmployeeId === employeeId;
  // Managers can view balances of their direct reports
  let isManager = false;
  if (!isAdmin && !isSelf && callerEmployeeId) {
    const target = await db.employee.findUnique({ where: { id: employeeId }, select: { managerId: true } });
    isManager = target?.managerId === callerEmployeeId;
  }
  if (!isAdmin && !isSelf && !isManager) {
    throw new Error("Not authorized to view these balances");
  }
  return db.timeOffBalance.findMany({
    where: { employeeId, year },
    include: { policy: true },
  });
}

export async function createTimeOffRequest(data: {
  policyId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
}) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) throw new Error("No employee profile linked to this account");

  const request = await db.timeOffRequest.create({
    data: {
      employeeId,
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

export async function approveTimeOffRequest(requestId: string) {
  const { callerEmployeeId } = await assertCanApprove(requestId);
  const request = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", approverId: callerEmployeeId },
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

export async function denyTimeOffRequest(requestId: string) {
  const { callerEmployeeId } = await assertCanApprove(requestId);
  const request = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "DENIED", approverId: callerEmployeeId },
  });
  revalidatePath("/time-off");
  return request;
}

export async function cancelTimeOffRequest(requestId: string) {
  const session = await requireAuth();
  const callerEmployeeId = session.user?.employeeId;
  const isAdmin = isAdminRole(session.user?.role);

  const request = await db.timeOffRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return null;

  // Owner can cancel their own request; admins/HR can cancel anyone's.
  const isOwner = callerEmployeeId === request.employeeId;
  if (!isAdmin && !isOwner) {
    throw new Error("Not authorized to cancel this request");
  }

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
  const session = await requireAuth();
  const role = session.user?.role;
  const callerEmployeeId = session.user?.employeeId;
  const isAdmin = isAdminRole(role);

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;

  // Admins/HR see everyone; managers see themselves + direct reports; everyone
  // else can only see their own requests.
  if (!isAdmin) {
    if (!callerEmployeeId) return [];
    if (role === "MANAGER") {
      const reports = await db.employee.findMany({
        where: { managerId: callerEmployeeId },
        select: { id: true },
      });
      const allowedIds = [callerEmployeeId, ...reports.map((r) => r.id)];
      if (filters?.employeeId && !allowedIds.includes(filters.employeeId)) return [];
      where.employeeId = filters?.employeeId ?? { in: allowedIds };
    } else {
      if (filters?.employeeId && filters.employeeId !== callerEmployeeId) return [];
      where.employeeId = callerEmployeeId;
    }
  } else if (filters?.employeeId) {
    where.employeeId = filters.employeeId;
  }

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
  await requireAuth();
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
  await requireAuth();
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
  await assertAdmin();
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
