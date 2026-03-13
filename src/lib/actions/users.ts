"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendWelcomeEmail } from "@/lib/email";

export async function getUsers() {
  return db.user.findMany({
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteUser(data: {
  email: string;
  password?: string;
  role: UserRole;
  employeeId?: string;
}) {
  const hash = data.password ? await bcrypt.hash(data.password, 10) : null;

  // If no employee record is linked, create one so the person appears in People
  let employeeId = data.employeeId || null;
  if (!employeeId) {
    const existingEmployee = await db.employee.findFirst({ where: { email: data.email } });
    if (existingEmployee) {
      employeeId = existingEmployee.id;
    } else {
      // Parse name from email (e.g. john.doe@company.com -> John Doe)
      const localPart = data.email.split("@")[0];
      const nameParts = localPart.split(/[._-]/);
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : "New";
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "Employee";

      const employee = await db.employee.create({
        data: {
          firstName,
          lastName,
          email: data.email,
          jobTitle: data.role === "ADMIN" ? "Administrator" : data.role === "MANAGER" ? "Manager" : "Employee",
          startDate: new Date(),
          anniversaryDate: new Date(),
          status: "ACTIVE",
        },
      });
      employeeId = employee.id;
      revalidatePath("/people");
      revalidatePath("/org");
    }
  }

  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash: hash,
      role: data.role,
      employeeId,
    },
  });
  revalidatePath("/settings");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  await sendWelcomeEmail({
    to: data.email,
    role: data.role,
    loginUrl: `${baseUrl}/login`,
  });

  return user;
}

export async function updateUserRole(id: string, role: UserRole) {
  const user = await db.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
  return user;
}

export async function deleteUser(id: string) {
  await db.user.delete({ where: { id } });
  revalidatePath("/settings");
}
