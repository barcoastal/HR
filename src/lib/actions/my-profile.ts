"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getMyProfile(employeeId: string) {
  return db.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      team: true,
      manager: true,
      buddy: true,
      clubMemberships: { include: { club: true } },
    },
  });
}

export async function updateMyProfile(
  employeeId: string,
  data: {
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    pronouns?: string | null;
    tShirtSize?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    bio?: string | null;
    hobbies?: string | null;
    dietaryRestrictions?: string | null;
  }
) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data,
  });
  revalidatePath("/my-profile");
  revalidatePath(`/people/${employeeId}`);
  return employee;
}

export async function getWelcomeData(employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      buddy: true,
      department: true,
      employeeTasks: {
        include: { checklistItem: { include: { checklist: true } } },
      },
    },
  });

  if (!employee) return null;

  const totalTasks = employee.employeeTasks.length;
  const completedTasks = employee.employeeTasks.filter(
    (t) => t.status === "DONE"
  ).length;

  return {
    employee,
    totalTasks,
    completedTasks,
    progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}
