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
  "EMPLOYEE_OFFBOARDING",
  "RECRUITER_ASSIGNED",
] as const;

const CHANNELS = ["EMAIL", "IN_APP"] as const;
const RECIPIENTS = ["candidate", "recruiter", "manager", "hr_team", "management"] as const;

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
  EMPLOYEE_OFFBOARDING: {
    EMAIL: ["management", "hr_team"],
    IN_APP: ["management", "hr_team"],
  },
  RECRUITER_ASSIGNED: {
    EMAIL: ["recruiter"],
    IN_APP: ["recruiter"],
  },
};

export async function seedNotificationRules() {
  const isFreshDb = (await db.notificationRule.count()) === 0;

  // Always upsert so newly-added ACTION_TYPES (e.g. RECRUITER_ASSIGNED) get
  // their default rows on existing deployments without resetting toggles
  // admins have already changed.
  for (const action of ACTION_TYPES) {
    for (const channel of CHANNELS) {
      const recipients = channel === "IN_APP"
        ? RECIPIENTS.filter((r) => r !== "candidate")
        : RECIPIENTS;

      for (const recipient of recipients) {
        const enabled = DEFAULTS[action]?.[channel]?.includes(recipient) ?? false;
        await db.notificationRule.upsert({
          where: {
            action_channel_recipient: { action, channel, recipient },
          },
          create: { action, channel, recipient, enabled },
          // Do NOT clobber an existing toggle; only insert defaults for new rows.
          update: {},
        });
      }
    }
  }

  if (!isFreshDb) return;

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

      // Migrate extra employee IDs to NotificationRecipient table (HR_TEAM group)
      for (const employeeId of extraIds) {
        await db.notificationRecipient.upsert({
          where: { employeeId_group: { employeeId, group: "HR_TEAM" } },
          create: { employeeId, group: "HR_TEAM" },
          update: {},
        });
      }
    }
  } catch (e) {
    console.error("[notification-seed] Failed to migrate existing settings:", e);
  }
}
