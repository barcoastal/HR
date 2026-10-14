import { db } from "@/lib/db";
import { oversightCoversDepartment } from "@/lib/review-milestones";

// "Review & 1:1 oversight alerts": HR picks people (NotificationRecipient
// group REVIEW_OVERSIGHT) and, optionally, the departments the rule covers.
// Those people are emailed and notified in-app when 1:1s are scheduled or
// completed and when review milestones are coming due, for employees in the
// covered departments. The rule starts disabled with nobody on it.

export const OVERSIGHT_GROUP = "REVIEW_OVERSIGHT";
export const OVERSIGHT_NOTIFICATION_TYPE = "REVIEW_OVERSIGHT";

export async function getOversightRule() {
  return db.reviewOversightRule.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", enabled: false, departmentIds: [] },
    update: {},
  });
}


type OversightRecipient = { id: string; email: string; firstName: string };

async function activeOversightRecipients(): Promise<OversightRecipient[]> {
  const rows = await db.notificationRecipient.findMany({
    where: {
      group: OVERSIGHT_GROUP,
      employee: {
        status: { not: "OFFBOARDED" },
        archivedAt: null,
        OR: [{ user: { is: null } }, { user: { is: { deactivatedAt: null } } }],
      },
    },
    select: { employee: { select: { id: true, email: true, firstName: true } } },
  });
  return rows.map((row) => row.employee);
}

/** Oversight recipients for an employee, or [] when the rule is off or does not cover them. */
export async function getOversightRecipientsForEmployee(employeeId: string): Promise<OversightRecipient[]> {
  const rule = await getOversightRule();
  if (!rule.enabled) return [];
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
  if (!employee || !oversightCoversDepartment(rule.departmentIds, employee.departmentId)) return [];
  return activeOversightRecipients();
}

/**
 * The departments whose review milestones this person may see on the calendar
 * as an oversight recipient: "all", a list, or null when they are not one.
 */
export async function getViewerOversightScope(employeeId?: string | null): Promise<readonly string[] | "all" | null> {
  if (!employeeId) return null;
  const [rule, membership] = await Promise.all([
    getOversightRule(),
    db.notificationRecipient.findUnique({ where: { employeeId_group: { employeeId, group: OVERSIGHT_GROUP } }, select: { id: true } }),
  ]);
  if (!rule.enabled || !membership) return null;
  return rule.departmentIds.length === 0 ? "all" : rule.departmentIds;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

export function appUrl(path: string): string {
  return `${(process.env.NEXTAUTH_URL || "").replace(/\/$/, "")}${path}`;
}

/**
 * Email + in-app alert to the oversight recipients covering `employeeId`.
 * Fail-soft: errors are logged, never thrown into the caller's workflow.
 * Returns how many people were alerted.
 */
export async function notifyOversight(params: {
  employeeId: string;
  subject: string;
  message: string;
  link: string;
  /** People already told about this through another path (e.g. the manager). */
  excludeEmployeeIds?: (string | null | undefined)[];
}): Promise<number> {
  try {
    const exclude = new Set(params.excludeEmployeeIds?.filter(Boolean) as string[]);
    const recipients = (await getOversightRecipientsForEmployee(params.employeeId)).filter((r) => !exclude.has(r.id));
    if (recipients.length === 0) return 0;
    const { sendEmail } = await import("@/lib/email");
    const href = appUrl(params.link);
    for (const recipient of recipients) {
      const html = `<p>Hi ${escapeHtml(recipient.firstName)},</p>
<p>${escapeHtml(params.message)}</p>
${href.startsWith("http") ? `<p><a href="${escapeHtml(href)}">Open in CALATRAVA</a></p>` : ""}
<p style="color:#666;font-size:12px">You receive this because you are on the Review &amp; 1:1 oversight alerts list in Settings.</p>`;
      const delivery = await sendEmail(recipient.email, params.subject, html);
      if (!delivery.success) console.error(`[oversight] Failed to email ${recipient.email}: ${delivery.error || delivery.status}`);
    }
    await db.notification.createMany({
      data: recipients.map((recipient) => ({
        recipientId: recipient.id,
        type: OVERSIGHT_NOTIFICATION_TYPE,
        message: params.message,
        link: params.link,
      })),
    });
    return recipients.length;
  } catch (err) {
    console.error("[oversight] Failed to send oversight alert:", err);
    return 0;
  }
}
