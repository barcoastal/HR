"use server";

import { db } from "@/lib/db";
import type { EmployeeStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getEmployees(filters?: {
  search?: string;
  department?: string;
  status?: EmployeeStatus;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.department && filters.department !== "All") {
    where.department = { name: filters.department };
  }

  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
      { jobTitle: { contains: filters.search } },
      { email: { contains: filters.search } },
    ];
  }

  return db.employee.findMany({
    where,
    include: { department: true, team: true },
    orderBy: { firstName: "asc" },
  });
}

export async function getEmployeeById(id: string) {
  return db.employee.findUnique({
    where: { id },
    include: {
      department: true,
      team: true,
      manager: true,
      buddy: true,
      directReports: true,
      documents: true,
      reviewsAsEmployee: {
        include: { reviewer: true, cycle: true },
        orderBy: { createdAt: "desc" },
      },
      employeeTasks: {
        include: { checklistItem: { include: { checklist: true } } },
      },
    },
  });
}

export async function createEmployee(data: {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId?: string;
  teamId?: string;
  managerId?: string;
  startDate: string;
  phone?: string;
  birthday?: string;
  location?: string;
  dietaryRestrictions?: string;
  bio?: string;
  hobbies?: string;
  status?: EmployeeStatus;
}) {
  const status = data.status || "ACTIVE";
  const employee = await db.employee.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      birthday: data.birthday ? new Date(data.birthday) : null,
      anniversaryDate: new Date(data.startDate),
      status,
    },
  });

  // Auto-assign onboarding checklist tasks when status is ONBOARDING
  if (status === "ONBOARDING") {
    const onboardingChecklists = await db.onboardingChecklist.findMany({
      where: { type: "ONBOARDING" },
      include: { items: { orderBy: { order: "asc" } } },
    });
    const allItems = onboardingChecklists.flatMap((c) => c.items);
    if (allItems.length > 0) {
      await db.employeeTask.createMany({
        data: allItems.map((item) => ({
          employeeId: employee.id,
          checklistItemId: item.id,
          status: "PENDING",
        })),
      });
    }
    revalidatePath("/onboarding");
  }

  revalidatePath("/people");
  revalidatePath("/org");
  return employee;
}

export async function updateEmployee(
  id: string,
  data: Record<string, unknown>
) {
  const { startDate, birthday, ...rest } = data;
  const employee = await db.employee.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate as string) } : {}),
      ...(birthday ? { birthday: new Date(birthday as string) } : {}),
    },
  });
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  return employee;
}

export async function startOffboarding(employeeId: string, endDate: string) {
  const offboardingChecklists = await db.onboardingChecklist.findMany({
    where: { type: "OFFBOARDING" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const allChecklistItems = offboardingChecklists.flatMap((c) => c.items);

  const employee = await db.employee.update({
    where: { id: employeeId },
    data: {
      status: "OFFBOARDED",
      endDate: new Date(endDate),
    },
  });

  if (allChecklistItems.length > 0) {
    await db.employeeTask.createMany({
      data: allChecklistItems.map((item) => ({
        employeeId: employee.id,
        checklistItemId: item.id,
        status: "PENDING",
      })),
    });
  }

  revalidatePath("/people");
  revalidatePath("/offboarding");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");

  return { employee, taskCount: allChecklistItems.length };
}

export async function setEmployeeManager(employeeId: string, managerId: string | null) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data: { managerId },
  });
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

export async function toggleEmployeeTask(taskId: string) {
  const task = await db.employeeTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  const updated = await db.employeeTask.update({
    where: { id: taskId },
    data: {
      status: task.status === "DONE" ? "PENDING" : "DONE",
      completedAt: task.status === "DONE" ? null : new Date(),
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  revalidatePath(`/people/${task.employeeId}`);
  return updated;
}

export async function addEmployeeTask(employeeId: string, checklistItemId: string) {
  const task = await db.employeeTask.create({
    data: { employeeId, checklistItemId, status: "PENDING" },
  });
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  return task;
}

export async function addCustomEmployeeTask(
  employeeId: string,
  title: string,
  description: string | undefined,
  type: "ONBOARDING" | "OFFBOARDING"
) {
  // Find or create a checklist for custom tasks
  let checklist = await db.onboardingChecklist.findFirst({
    where: { name: `Custom ${type === "ONBOARDING" ? "Onboarding" : "Offboarding"} Tasks`, type },
  });
  if (!checklist) {
    checklist = await db.onboardingChecklist.create({
      data: { name: `Custom ${type === "ONBOARDING" ? "Onboarding" : "Offboarding"} Tasks`, type },
    });
  }

  const maxOrder = await db.checklistItem.findFirst({
    where: { checklistId: checklist.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const checklistItem = await db.checklistItem.create({
    data: {
      checklistId: checklist.id,
      title,
      description: description || null,
      order: (maxOrder?.order ?? -1) + 1,
    },
  });

  const task = await db.employeeTask.create({
    data: { employeeId, checklistItemId: checklistItem.id, status: "PENDING" },
  });

  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  revalidatePath("/settings");
  return task;
}

export async function completeOnboarding(employeeId: string) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

export async function deleteEmployee(id: string) {
  await db.employee.delete({ where: { id } });
  revalidatePath("/people");
  revalidatePath("/org");
}
