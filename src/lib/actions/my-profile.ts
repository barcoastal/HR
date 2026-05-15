"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Resolve the caller's own employee id. We never accept it from the client —
 * an attacker would just pass a peer's id. Admins are allowed to view/edit any
 * profile via the existing /people/[id] flow + updateEmployee server action.
 */
async function getCallerEmployeeIdOrThrow(): Promise<string> {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) {
    throw new Error("No employee profile linked to this account");
  }
  return employeeId;
}

export async function getMyProfile() {
  const employeeId = await getCallerEmployeeIdOrThrow();
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

export async function updateMyProfile(data: {
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
}) {
  const employeeId = await getCallerEmployeeIdOrThrow();
  const employee = await db.employee.update({
    where: { id: employeeId },
    data,
  });
  revalidatePath("/my-profile");
  revalidatePath(`/people/${employeeId}`);
  return employee;
}

export async function updateProfilePhoto(photoUrl: string) {
  const employeeId = await getCallerEmployeeIdOrThrow();
  await db.employee.update({
    where: { id: employeeId },
    data: { profilePhoto: photoUrl },
  });
  revalidatePath("/my-profile");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/people");
  revalidatePath("/");
}

export async function getWelcomeData() {
  const employeeId = await getCallerEmployeeIdOrThrow();
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
