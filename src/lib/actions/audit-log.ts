"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function getAuditLog(filters?: {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorEmail?: string;
  limit?: number;
  cursor?: string;
}) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can view the audit log");
  }

  const where: Record<string, unknown> = {};
  if (filters?.action) where.action = filters.action;
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.entityId) where.entityId = filters.entityId;
  if (filters?.actorEmail) where.actorEmail = { contains: filters.actorEmail, mode: "insensitive" };

  const limit = filters?.limit ?? 100;
  return db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filters?.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });
}

export async function getAuditLogActions() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") return [];
  const rows = await db.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });
  return rows.map((r) => r.action);
}
