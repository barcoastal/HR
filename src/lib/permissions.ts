// Client-safe permissions — no DB imports
// For server-side DB-driven permission checks, use permissions-server.ts

import type { UserRole } from "@/generated/prisma/client";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions-config";
import type { PermissionKey } from "@/lib/permissions-config";

export { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from "@/lib/permissions-config";
export type { PermissionKey } from "@/lib/permissions-config";

// Role hierarchy: SUPER_ADMIN > ADMIN > HR > MANAGER > EMPLOYEE
const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  HR: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

export function getRoleLevel(role: UserRole): number {
  return ROLE_LEVEL[role] || 1;
}

// Synchronous check using defaults (safe for client components)
export function hasPermissionSync(role: UserRole, permission: PermissionKey): boolean {
  if (role === "SUPER_ADMIN") return true;
  return DEFAULT_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessSettings(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canManageEmployees(role: UserRole) {
  return hasPermissionSync(role, "manage_employees");
}

export function canManageDepartments(role: UserRole) {
  return hasPermissionSync(role, "departments");
}

export function canAccessRecruitment(role: UserRole) {
  return hasPermissionSync(role, "recruitment");
}

export function canAccessAnalytics(role: UserRole) {
  return hasPermissionSync(role, "analytics");
}

export function canWriteReviews(role: UserRole) {
  return true;
}

export function canPostToFeed(role: UserRole) {
  return true;
}

export function canManageTimeOff(role: UserRole) {
  return hasPermissionSync(role, "time_off");
}

export function canApproveTimeOff(role: UserRole) {
  return hasPermissionSync(role, "approve_time_off");
}

export function canManagePulse(role: UserRole) {
  return hasPermissionSync(role, "pulse");
}

export function canManageDocuments(role: UserRole) {
  return hasPermissionSync(role, "documents");
}

export function canViewHRData(role: UserRole) {
  return hasPermissionSync(role, "hr_notes");
}

export function canManageOnboarding(role: UserRole) {
  return hasPermissionSync(role, "onboarding");
}

export function canManageOffboarding(role: UserRole) {
  return hasPermissionSync(role, "offboarding");
}
