import { db } from "@/lib/db";
import { getEnabledRecipients, getHrTeamEmployeeIds, getGroupEmployeeIds } from "./rules";

type SendParams = {
  action: string;
  candidateId?: string;
  employeeId?: string;
  message: string;
  link?: string;
  emailSubject?: string;
  emailBody?: string;
};

type ResolvedRecipient = {
  key: string;
  email?: string;
  employeeId?: string;
  firstName?: string;
};

async function resolveRecipients(
  recipientKeys: string[],
  candidateId?: string,
  employeeId?: string
): Promise<ResolvedRecipient[]> {
  const resolved: ResolvedRecipient[] = [];

  // Load candidate if needed
  let candidate: { email: string; firstName: string; lastName: string; recruiterId: string | null; managerId: string | null } | null = null;
  if (candidateId) {
    candidate = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true, firstName: true, lastName: true, recruiterId: true, managerId: true },
    });
  }

  // Load employee if needed (for employee-centric actions)
  let employee: { email: string; firstName: string; managerId: string | null } | null = null;
  if (employeeId && !candidate) {
    employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, firstName: true, managerId: true },
    });
  }

  for (const key of recipientKeys) {
    switch (key) {
      case "candidate": {
        if (candidate?.email) {
          resolved.push({ key, email: candidate.email, firstName: candidate.firstName });
        }
        break;
      }
      case "recruiter": {
        const recruiterId = candidate?.recruiterId;
        if (recruiterId) {
          const recruiter = await db.employee.findUnique({
            where: { id: recruiterId },
            select: { id: true, email: true, firstName: true },
          });
          if (recruiter) {
            resolved.push({ key, email: recruiter.email, employeeId: recruiter.id, firstName: recruiter.firstName });
          }
        }
        break;
      }
      case "manager": {
        const managerId = candidate?.managerId || employee?.managerId;
        if (managerId) {
          const manager = await db.employee.findUnique({
            where: { id: managerId },
            select: { id: true, email: true, firstName: true },
          });
          if (manager) {
            resolved.push({ key, email: manager.email, employeeId: manager.id, firstName: manager.firstName });
          }
        }
        break;
      }
      case "hr_team": {
        const hrIds = await getHrTeamEmployeeIds();
        if (hrIds.length > 0) {
          const hrMembers = await db.employee.findMany({
            where: { id: { in: hrIds } },
            select: { id: true, email: true, firstName: true },
          });
          for (const hr of hrMembers) {
            resolved.push({ key, email: hr.email, employeeId: hr.id, firstName: hr.firstName });
          }
        }
        break;
      }
      case "management": {
        const mgmtIds = await getGroupEmployeeIds("MANAGEMENT");
        if (mgmtIds.length > 0) {
          const mgmt = await db.employee.findMany({
            where: { id: { in: mgmtIds } },
            select: { id: true, email: true, firstName: true },
          });
          for (const m of mgmt) {
            resolved.push({ key, email: m.email, employeeId: m.id, firstName: m.firstName });
          }
        }
        break;
      }
    }
  }

  return resolved;
}

export async function sendNotifications(params: SendParams): Promise<void> {
  const { action, candidateId, employeeId, message, link, emailSubject, emailBody } = params;

  try {
    // Resolve email recipients
    const emailRecipientKeys = await getEnabledRecipients(action, "EMAIL");
    const inAppRecipientKeys = await getEnabledRecipients(action, "IN_APP");

    const allKeys = [...new Set([...emailRecipientKeys, ...inAppRecipientKeys])];
    if (allKeys.length === 0) return;

    const resolved = await resolveRecipients(allKeys, candidateId, employeeId);

    // Send emails
    if (emailSubject && emailBody && emailRecipientKeys.length > 0) {
      const { sendEmail } = await import("@/lib/email");
      const emailRecipients = resolved.filter((r) => emailRecipientKeys.includes(r.key) && r.email);

      // Deduplicate by email
      const seen = new Set<string>();
      for (const r of emailRecipients) {
        if (r.email && !seen.has(r.email)) {
          seen.add(r.email);
          sendEmail(r.email, emailSubject, emailBody).catch((err) =>
            console.error(`[notifications] Failed to email ${r.email}:`, err)
          );
        }
      }
    }

    // Create in-app notifications
    if (inAppRecipientKeys.length > 0) {
      const inAppRecipients = resolved.filter((r) => inAppRecipientKeys.includes(r.key) && r.employeeId);

      // Deduplicate by employeeId
      const seen = new Set<string>();
      const notificationData: { recipientId: string; type: string; message: string; link: string | null }[] = [];
      for (const r of inAppRecipients) {
        if (r.employeeId && !seen.has(r.employeeId)) {
          seen.add(r.employeeId);
          notificationData.push({
            recipientId: r.employeeId,
            type: action,
            message,
            link: link || null,
          });
        }
      }

      if (notificationData.length > 0) {
        await db.notification.createMany({ data: notificationData });
      }
    }
  } catch (err) {
    console.error(`[notifications] Failed to send notifications for ${action}:`, err);
  }
}
