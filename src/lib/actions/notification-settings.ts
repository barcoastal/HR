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
  hrTeamEmployeeIds: string[]
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

  // Sync HR team recipients
  await db.notificationRecipient.deleteMany({});
  if (hrTeamEmployeeIds.length > 0) {
    await db.notificationRecipient.createMany({
      data: hrTeamEmployeeIds.map((employeeId) => ({ employeeId })),
    });
  }

  revalidatePath("/settings");
}
