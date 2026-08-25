import { db } from "@/lib/db";

export async function getEnabledRecipients(
  action: string,
  channel: "EMAIL" | "IN_APP"
): Promise<string[]> {
  const rules = await db.notificationRule.findMany({
    where: { action, channel, enabled: true },
    select: { recipient: true },
  });
  return rules.map((r) => r.recipient);
}

export async function shouldNotify(
  action: string,
  channel: "EMAIL" | "IN_APP",
  recipient: string
): Promise<boolean> {
  const rule = await db.notificationRule.findUnique({
    where: { action_channel_recipient: { action, channel, recipient } },
  });
  return rule?.enabled ?? false;
}

/** IDs of employees configured to receive notifications for a given group. */
export async function getGroupEmployeeIds(group: string): Promise<string[]> {
  const recipients = await db.notificationRecipient.findMany({
    where: { group },
    select: { employeeId: true },
  });
  return recipients.map((r) => r.employeeId);
}

// Back-compat alias for existing callers
export async function getHrTeamEmployeeIds(): Promise<string[]> {
  const configuredIds = await getGroupEmployeeIds("HR_TEAM");
  if (configuredIds.length > 0) return configuredIds;

  // A fresh installation may not have an explicit HR Team group yet. Falling
  // back to linked HR/admin accounts ensures internal workflow alerts are not
  // silently dropped before Settings has been configured.
  const hrUsers = await db.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "ADMIN", "HR"] },
      employeeId: { not: null },
    },
    select: { employeeId: true },
  });
  return hrUsers.flatMap((user) => user.employeeId ? [user.employeeId] : []);
}
