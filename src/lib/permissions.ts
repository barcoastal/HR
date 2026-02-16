import type { UserRole } from "@/generated/prisma/client";

export function canAccessSettings(role: UserRole) {
  return role === "ADMIN";
}

export function canManageEmployees(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canManageDepartments(role: UserRole) {
  return role === "ADMIN";
}

export function canAccessRecruitment(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessAnalytics(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canWriteReviews(role: UserRole) {
  return true; // all roles can submit their own reviews
}

export function canPostToFeed(role: UserRole) {
  return true; // all roles can post
}

export function canManageTimeOff(role: UserRole) {
  return role === "ADMIN";
}

export function canApproveTimeOff(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canManagePulse(role: UserRole) {
  return role === "ADMIN";
}
