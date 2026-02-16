"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  return db.user.findMany({
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteUser(data: {
  email: string;
  password: string;
  role: UserRole;
  employeeId?: string;
}) {
  const hash = await bcrypt.hash(data.password, 10);
  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash: hash,
      role: data.role,
      employeeId: data.employeeId || null,
    },
  });
  revalidatePath("/settings");
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
