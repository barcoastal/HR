"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getNotificationRules() {
  return db.notificationRule.findMany({
    orderBy: [{ action: "asc" }, { channel: "asc" }, { recipient: "asc" }],
  });
}

export async function getNotificationRecipients() {
  return db.notificationRecipient.findMany({
    include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function saveNotificationRules(
  rules: { action: string; channel: string; recipient: string; enabled: boolean }[],
  hrTeamEmployeeIds: string[],
  managementEmployeeIds: string[] = []
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  // Upsert all rules
  for (const rule of rules) {
    await db.notificationRule.upsert({
      where: {
        action_channel_recipient: {
          action: rule.action,
          channel: rule.channel,
          recipient: rule.recipient,
        },
      },
      create: {
        action: rule.action,
        channel: rule.channel,
        recipient: rule.recipient,
        enabled: rule.enabled,
      },
      update: { enabled: rule.enabled },
    });
  }

  // Sync HR Team recipients
  await db.notificationRecipient.deleteMany({ where: { group: "HR_TEAM" } });
  if (hrTeamEmployeeIds.length > 0) {
    await db.notificationRecipient.createMany({
      data: hrTeamEmployeeIds.map((employeeId) => ({ employeeId, group: "HR_TEAM" })),
    });
  }

  // Sync Management recipients
  await db.notificationRecipient.deleteMany({ where: { group: "MANAGEMENT" } });
  if (managementEmployeeIds.length > 0) {
    await db.notificationRecipient.createMany({
      data: managementEmployeeIds.map((employeeId) => ({ employeeId, group: "MANAGEMENT" })),
    });
  }

  revalidatePath("/settings");
}

/** Settings → Notifications: the "Review & 1:1 oversight alerts" rule. */
export async function getReviewOversightSettings() {
  const { requireAdmin } = await import("@/lib/auth-helpers");
  await requireAdmin();
  const { getOversightRule, OVERSIGHT_GROUP } = await import("@/lib/review-oversight");
  const [rule, recipients] = await Promise.all([
    getOversightRule(),
    db.notificationRecipient.findMany({ where: { group: OVERSIGHT_GROUP }, select: { employeeId: true } }),
  ]);
  return { enabled: rule.enabled, departmentIds: rule.departmentIds, recipientIds: recipients.map((r) => r.employeeId) };
}

export async function saveReviewOversightSettings(input: {
  enabled: boolean;
  recipientIds: string[];
  departmentIds: string[];
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Not authorized" };
  }
  const { OVERSIGHT_GROUP } = await import("@/lib/review-oversight");
  const [employees, departments] = await Promise.all([
    db.employee.findMany({ where: { id: { in: [...new Set(input.recipientIds)] } }, select: { id: true } }),
    db.department.findMany({ where: { id: { in: [...new Set(input.departmentIds)] } }, select: { id: true } }),
  ]);
  const recipientIds = employees.map((e) => e.id);
  const departmentIds = departments.map((d) => d.id);

  await db.$transaction([
    db.reviewOversightRule.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", enabled: !!input.enabled, departmentIds },
      update: { enabled: !!input.enabled, departmentIds },
    }),
    db.notificationRecipient.deleteMany({ where: { group: OVERSIGHT_GROUP } }),
    db.notificationRecipient.createMany({
      data: recipientIds.map((employeeId) => ({ employeeId, group: OVERSIGHT_GROUP })),
    }),
  ]);
  revalidatePath("/settings");
  revalidatePath("/calendar");
  return { success: true };
}
