import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type AuditPayload = {
  action: string; // e.g. "employee.archived", "user.role.changed"
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

/**
 * Write a row to the audit log. Fire-and-forget — never throws into the
 * caller, never blocks the user-facing action. Pulls the actor from the
 * current NextAuth session.
 */
export async function audit(payload: AuditPayload): Promise<void> {
  try {
    const session = await getServerSession(authOptions);
    await db.auditLog.create({
      data: {
        actorUserId: session?.user?.id ?? null,
        actorEmployeeId: session?.user?.employeeId ?? null,
        actorEmail: session?.user?.email ?? null,
        actorRole: session?.user?.role ?? null,
        action: payload.action,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        details: (payload.details as object | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record:", payload.action, err);
  }
}
