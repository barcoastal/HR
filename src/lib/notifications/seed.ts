import { db } from "@/lib/db";

const ACTION_TYPES = [
  "STAGE_CHANGE",
  "OFFER_SENT",
  "OFFER_SIGNED",
  "DOCUMENT_SIGN_REQUEST",
  "DOCUMENT_SIGNED",
  "INTERVIEW_SCHEDULED",
  "NEW_HIRE",
  "TASK_ASSIGNED",
  "ONBOARDING_COMPLETED",
] as const;

const CHANNELS = ["EMAIL", "IN_APP"] as const;
const RECIPIENTS = ["candidate", "recruiter", "manager", "hr_team"] as const;

// Default enabled state per action×channel×recipient
const DEFAULTS: Record<string, Record<string, string[]>> = {
  STAGE_CHANGE: {
    EMAIL: ["candidate", "recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
  OFFER_SENT: {
    EMAIL: ["candidate", "recruiter"],
    IN_APP: ["recruiter"],
  },
  OFFER_SIGNED: {
    EMAIL: ["recruiter", "hr_team"],
    IN_APP: ["recruiter", "hr_team"],
  },
  DOCUMENT_SIGN_REQUEST: {
    EMAIL: ["candidate"],
    IN_APP: [],
  },
  DOCUMENT_SIGNED: {
    EMAIL: ["recruiter", "hr_team"],
    IN_APP: ["recruiter", "hr_team"],
  },
  INTERVIEW_SCHEDULED: {
    EMAIL: ["candidate", "recruiter"],
    IN_APP: ["recruiter"],
  },
  NEW_HIRE: {
    EMAIL: ["candidate", "recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
  TASK_ASSIGNED: {
    EMAIL: [],
    IN_APP: ["recruiter"],
  },
  ONBOARDING_COMPLETED: {
    EMAIL: ["recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
};

export async function seedNotificationRules() {
  const existing = await db.notificationRule.count();
  if (existing > 0) return; // Already seeded

  const rules: { action: string; channel: string; recipient: string; enabled: boolean }[] = [];

  for (const action of ACTION_TYPES) {
    for (const channel of CHANNELS) {
      // Skip candidate + IN_APP (candidates don't have accounts)
      const recipients = channel === "IN_APP"
        ? RECIPIENTS.filter((r) => r !== "candidate")
        : RECIPIENTS;

      for (const recipient of recipients) {
        const enabled = DEFAULTS[action]?.[channel]?.includes(recipient) ?? false;
        rules.push({ action, channel, recipient, enabled });
      }
    }
  }

  await db.notificationRule.createMany({ data: rules });

  // Migrate existing CompanySettings recipients for STAGE_CHANGE
  try {
    const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
    if (settings) {
      const stageRecipients: string[] = JSON.parse(settings.stageNotifyRecipients || "[]");
      const extraIds: string[] = JSON.parse(settings.stageNotifyEmployeeIds || "[]");

      // Override STAGE_CHANGE EMAIL rules based on existing settings
      for (const recipient of ["candidate", "recruiter", "manager"] as const) {
        const enabled = stageRecipients.includes(recipient);
        await db.notificationRule.updateMany({
          where: { action: "STAGE_CHANGE", channel: "EMAIL", recipient },
          data: { enabled },
        });
        // Also set IN_APP to match (except candidate)
        if (recipient !== "candidate") {
          await db.notificationRule.updateMany({
            where: { action: "STAGE_CHANGE", channel: "IN_APP", recipient },
            data: { enabled },
          });
        }
      }

      // hr_team enabled if there are extra employee IDs
      const hrEnabled = extraIds.length > 0 || stageRecipients.includes("hr_team");
      await db.notificationRule.updateMany({
        where: { action: "STAGE_CHANGE", recipient: "hr_team" },
        data: { enabled: hrEnabled },
      });

      // Migrate extra employee IDs to NotificationRecipient table
      for (const employeeId of extraIds) {
        await db.notificationRecipient.upsert({
          where: { employeeId },
          create: { employeeId },
          update: {},
        });
      }
    }
  } catch (e) {
    console.error("[notification-seed] Failed to migrate existing settings:", e);
  }
}
