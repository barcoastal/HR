"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { DEFAULT_PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions-config";
import { invalidatePermissionCache } from "@/lib/permissions-server";
import type { UserRole } from "@/generated/prisma/client";

export async function getRolePermissions(): Promise<Record<string, string[]>> {
  const rows = await db.rolePermission.findMany();

  // If no DB rows, return defaults
  if (rows.length === 0) {
    return { ...DEFAULT_PERMISSIONS };
  }

  const result: Record<string, string[]> = {};
  for (const role of ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "EMPLOYEE"]) {
    const roleRows = rows.filter((r) => r.role === role);
    if (roleRows.length === 0) {
      // No overrides for this role — use defaults
      result[role] = DEFAULT_PERMISSIONS[role] || [];
    } else {
      result[role] = roleRows.filter((r) => r.granted).map((r) => r.permission);
    }
  }
  return result;
}

export async function updateRolePermissions(
  role: string,
  permissions: Record<string, boolean>
) {
  // Only a SUPER_ADMIN can rewrite the permission matrix — otherwise any
  // signed-in user could grant their own role admin powers.
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only a SUPER_ADMIN can change role permissions");
  }

  // SUPER_ADMIN permissions cannot be changed
  if (role === "SUPER_ADMIN") return;

  const allKeys = ALL_PERMISSIONS.map((p) => p.key);

  // Upsert each permission
  for (const key of allKeys) {
    const granted = permissions[key] ?? false;
    await db.rolePermission.upsert({
      where: { role_permission: { role: role as UserRole, permission: key } },
      update: { granted },
      create: { role: role as UserRole, permission: key, granted },
    });
  }

  invalidatePermissionCache();
  revalidatePath("/settings");
}
