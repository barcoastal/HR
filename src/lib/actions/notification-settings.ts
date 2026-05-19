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
