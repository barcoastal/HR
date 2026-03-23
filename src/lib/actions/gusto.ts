"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  decrypt,
  fetchGustoEmployees,
  fetchPayrollRuns,
  fetchPayrollDetail,
  approvePayroll as gustoApprovePayroll,
  fetchTimeOffPolicies,
  fetchTimeOffRequests,
  fetchEmployeeTimeOffBalances,
  createTimeOffRequest as gustoCreateTimeOffRequest,
  approveTimeOffRequest as gustoApproveTimeOff,
  denyTimeOffRequest as gustoDenyTimeOff,
  fetchEmployeeCompensations,
  fetchEmployeePayStubs,
  deleteWebhookSubscription,
  type GustoEmployee,
  type GustoPayroll,
  type GustoPayrollEmployee,
  type GustoTimeOffPolicy,
  type GustoTimeOffRequest,
  type GustoTimeOffBalance,
  type GustoCompensation,
} from "@/lib/gusto";

// ── Connection ──────────────────────────────────────────────

export async function getGustoConnection() {
  return db.gustoConnection.findFirst();
}

export async function isGustoConnected(): Promise<boolean> {
  const conn = await db.gustoConnection.findFirst({ select: { id: true } });
  return !!conn;
}

export async function disconnectGusto() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  const conn = await db.gustoConnection.findFirst();
  if (!conn) return;

  if (conn.webhookSubId) {
    try {
      const accessToken = decrypt(conn.accessToken);
      await deleteWebhookSubscription(accessToken, conn.companyId, conn.webhookSubId);
    } catch {
      // Best effort
    }
  }

  await db.employee.updateMany({
    where: { gustoEmployeeId: { not: null } },
    data: { gustoEmployeeId: null },
  });

  await db.gustoConnection.delete({ where: { id: conn.id } });

  revalidatePath("/settings");
  revalidatePath("/gusto");
}

// ── Employees ───────────────────────────────────────────────

export async function getGustoEmployeeList(): Promise<GustoEmployee[]> {
  return fetchGustoEmployees();
}

export async function getEmployeeMapping() {
  const [gustoEmps, calEmps] = await Promise.all([
    fetchGustoEmployees(),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, gustoEmployeeId: true },
    }),
  ]);

  const mapped = calEmps.filter((e) => e.gustoEmployeeId);
  const unmappedGusto = gustoEmps.filter(
    (ge) => !calEmps.some((ce) => ce.gustoEmployeeId === ge.uuid)
  );
  const unmappedCal = calEmps.filter((e) => !e.gustoEmployeeId);

  return { gustoEmps, mapped, unmappedGusto, unmappedCal };
}

export async function mapEmployeeToGusto(employeeId: string, gustoEmployeeId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { gustoEmployeeId },
  });

  revalidatePath("/settings");
}

export async function unmapEmployee(employeeId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { gustoEmployeeId: null },
  });

  revalidatePath("/settings");
}

// ── Payroll ─────────────────────────────────────────────────

export async function getPayrolls(): Promise<GustoPayroll[]> {
  return fetchPayrollRuns();
}

export async function getPayrollDetail(payrollId: string): Promise<GustoPayroll> {
  return fetchPayrollDetail(payrollId);
}

export async function approvePayrollRun(payrollId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoApprovePayroll(payrollId);
  revalidatePath("/gusto");
}

// ── Time Off ────────────────────────────────────────────────

export async function getGustoTimeOffPolicies(): Promise<GustoTimeOffPolicy[]> {
  return fetchTimeOffPolicies();
}

export async function getGustoTimeOffRequests(status?: string): Promise<GustoTimeOffRequest[]> {
  return fetchTimeOffRequests(status);
}

export async function getEmployeeTimeOffBalances(gustoEmployeeId: string): Promise<GustoTimeOffBalance[]> {
  return fetchEmployeeTimeOffBalances(gustoEmployeeId);
}

export async function requestTimeOff(data: {
  gustoEmployeeId: string;
  timeOffPolicyUuid: string;
  startDate: string;
  endDate: string;
  note?: string;
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  await requireAuth();

  const result = await gustoCreateTimeOffRequest({
    employeeUuid: data.gustoEmployeeId,
    timeOffPolicyUuid: data.timeOffPolicyUuid,
    startDate: data.startDate,
    endDate: data.endDate,
    note: data.note,
  });

  revalidatePath("/time-off");
  return result;
}

export async function approveTimeOff(requestUuid: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoApproveTimeOff(requestUuid);
  revalidatePath("/time-off");
  revalidatePath("/gusto");
}

export async function denyTimeOff(requestUuid: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoDenyTimeOff(requestUuid);
  revalidatePath("/time-off");
  revalidatePath("/gusto");
}

// ── Employee Profile Data ───────────────────────────────────

export async function getEmployeeCompensation(gustoEmployeeId: string): Promise<GustoCompensation[]> {
  return fetchEmployeeCompensations(gustoEmployeeId);
}

export async function getEmployeePayStubs(gustoEmployeeId: string): Promise<GustoPayrollEmployee[]> {
  return fetchEmployeePayStubs(gustoEmployeeId);
}
