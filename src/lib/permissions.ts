import type { UserRole } from "@/generated/prisma/client";

// Role hierarchy: ADMIN > HR > MANAGER > EMPLOYEE
const ROLE_LEVEL: Record<string, number> = {
  ADMIN: 4,
  HR: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

export function getRoleLevel(role: UserRole): number {
  return ROLE_LEVEL[role] || 1;
}

export function canAccessSettings(role: UserRole) {
  return role === "ADMIN";
}

export function canManageEmployees(role: UserRole) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canManageDepartments(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canAccessRecruitment(role: UserRole) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canAccessAnalytics(role: UserRole) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canWriteReviews(role: UserRole) {
  return true; // all roles can submit their own reviews
}

export function canPostToFeed(role: UserRole) {
  return true; // all roles can post
}

export function canManageTimeOff(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canApproveTimeOff(role: UserRole) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canManagePulse(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canManageDocuments(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canViewHRData(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canManageOnboarding(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}

export function canManageOffboarding(role: UserRole) {
  return role === "ADMIN" || role === "HR";
}
