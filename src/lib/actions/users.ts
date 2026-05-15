"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendWelcomeEmail } from "@/lib/email";

/**
 * Hierarchy guard: an ADMIN cannot attack a SUPER_ADMIN account, and cannot
 * mint another SUPER_ADMIN. Only a SUPER_ADMIN can manage SUPER_ADMINs.
 */
function assertCanActOnRole(callerRole: UserRole | undefined, targetRole: UserRole | undefined) {
  if (targetRole === "SUPER_ADMIN" && callerRole !== "SUPER_ADMIN") {
    throw new Error("Only a SUPER_ADMIN can manage SUPER_ADMIN accounts");
  }
}

export async function getUsers() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const callerRole = session.user?.role;
  if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
    throw new Error("Not authorized to view users");
  }
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
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const callerRole = session.user?.role;
  if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
    throw new Error("Not authorized to invite users");
  }
  assertCanActOnRole(callerRole, data.role);

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
          jobTitle: data.role === "SUPER_ADMIN" ? "Super Administrator" : data.role === "ADMIN" ? "Administrator" : data.role === "HR" ? "HR Manager" : data.role === "MANAGER" ? "Manager" : "Employee",
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

export async function setUserPassword(userId: string, password: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const callerRole = session.user?.role;
  if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
    throw new Error("Not authorized to set passwords");
  }
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) {
    return { success: false, error: "User not found." };
  }
  assertCanActOnRole(callerRole, target.role);

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath("/settings");
  return { success: true };
}

export async function updateUserRole(id: string, role: UserRole) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const callerRole = session.user?.role;
  if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
    throw new Error("Not authorized to change user roles");
  }
  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) {
    throw new Error("User not found");
  }
  // Block touching a SUPER_ADMIN unless caller is also one, AND block any
  // non-SUPER_ADMIN from promoting another user to SUPER_ADMIN.
  assertCanActOnRole(callerRole, target.role);
  assertCanActOnRole(callerRole, role);

  const user = await db.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
  return user;
}

export async function deleteUser(id: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const callerRole = session.user?.role;
  if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
    throw new Error("Not authorized to delete users");
  }

  // Prevent deleting yourself
  if (session.user?.id === id) {
    throw new Error("You cannot delete your own account");
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) {
    throw new Error("User not found");
  }
  assertCanActOnRole(callerRole, target.role);

  await db.user.delete({ where: { id } });
  revalidatePath("/settings");
}
