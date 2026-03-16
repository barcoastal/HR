// Server-only permissions with DB-driven overrides
import type { UserRole } from "@/generated/prisma/client";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions-config";
import type { PermissionKey } from "@/lib/permissions-config";

let permissionCache: Map<string, Set<string>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000;

async function loadPermissionsFromDB(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (permissionCache && now - cacheTimestamp < CACHE_TTL) {
    return permissionCache;
  }

  try {
    const { db } = await import("@/lib/db");
    const rows = await db.rolePermission.findMany();

    if (rows.length === 0) {
      permissionCache = null;
      cacheTimestamp = now;
      return new Map();
    }

    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!map.has(row.role)) map.set(row.role, new Set());
      if (row.granted) map.get(row.role)!.add(row.permission);
    }
    permissionCache = map;
    cacheTimestamp = now;
    return map;
  } catch {
    return new Map();
  }
}

export async function hasPermission(role: UserRole, permission: PermissionKey): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;

  const dbPerms = await loadPermissionsFromDB();

  if (dbPerms.has(role)) {
    return dbPerms.get(role)!.has(permission);
  }

  return DEFAULT_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function invalidatePermissionCache() {
  permissionCache = null;
  cacheTimestamp = 0;
}
