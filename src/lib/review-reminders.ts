import { db } from "@/lib/db";
import { displayName } from "@/lib/utils";
import { dateKey, formatInZone, zonedDateFromInput } from "@/lib/time-zone";
import { addDaysToKey, REMINDER_LEAD_DAYS, selectDueReminders } from "@/lib/review-milestones";
import { loadReviewMilestones } from "@/lib/review-milestones-server";
import { appUrl, escapeHtml, notifyOversight } from "@/lib/review-oversight";

export const REVIEW_REMINDER_NOTIFICATION_TYPE = "REVIEW_MILESTONE_REMINDER";

function formatDueDate(key: string) {
  const date = zonedDateFromInput(key, "12:00");
  return date ? formatInZone(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : key;
}

/**
 * Daily: for every unscheduled review milestone due within the next week,
 * email + notify the employee's manager (and the oversight recipients covering
 * the employee) once. A ReviewMilestoneReminder row is claimed before sending,
 * so overlapping or repeated runs never send the same reminder twice.
 */
export async function runReviewMilestoneReminders(now = new Date()) {
  const todayKey = dateKey(now);
  const { employees, milestones } = await loadReviewMilestones({
    fromKey: todayKey,
    toKey: addDaysToKey(todayKey, REMINDER_LEAD_DAYS),
    todayKey,
  });
  const sentRows = milestones.length
    ? await db.reviewMilestoneReminder.findMany({ where: { milestoneKey: { in: milestones.map((m) => m.key) } }, select: { milestoneKey: true } })
    : [];
  const due = selectDueReminders(milestones, todayKey, new Set(sentRows.map((row) => row.milestoneKey)));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const results: { milestoneKey: string; employee: string; status: string; recipients: number }[] = [];

  for (const milestone of due) {
    const employee = employeeById.get(milestone.employeeId);
    if (!employee) continue;
    // Claim first: a concurrent run hits the unique key and skips.
    try {
      await db.reviewMilestoneReminder.create({
        data: { milestoneKey: milestone.key, employeeId: employee.id, kind: milestone.kind, dueDate: milestone.dueKey },
      });
    } catch {
      results.push({ milestoneKey: milestone.key, employee: employee.id, status: "already_sent", recipients: 0 });
      continue;
    }

    const name = displayName(employee);
    const dueLabel = formatDueDate(milestone.dueKey);
    const link = `/calendar?milestone=${encodeURIComponent(milestone.key)}`;
    const message = `${name}'s ${milestone.label} is due on ${dueLabel} — schedule it`;
    const subject = `Schedule ${name}'s ${milestone.label} (due ${dueLabel})`;
    let recipients = 0;

    const manager = employee.managerId
      ? await db.employee.findFirst({
          where: { id: employee.managerId, status: { not: "OFFBOARDED" }, archivedAt: null },
          select: { id: true, email: true, firstName: true, user: { select: { deactivatedAt: true } } },
        })
      : null;
    if (manager && !manager.user?.deactivatedAt) {
      try {
        const { sendEmail } = await import("@/lib/email");
        const href = appUrl(link);
        const delivery = await sendEmail(manager.email, subject, `<p>Hi ${escapeHtml(manager.firstName)},</p>
<p><strong>${escapeHtml(name)}</strong>'s ${escapeHtml(milestone.label)} is due on <strong>${escapeHtml(dueLabel)}</strong>.</p>
<p>Please schedule the meeting now so it is on both calendars in time.</p>
${href.startsWith("http") ? `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 20px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Schedule it</a></p>` : ""}`);
        if (!delivery.success) console.error(`[review-reminders] Failed to email ${manager.email}: ${delivery.error || delivery.status}`);
        await db.notification.create({
          data: { recipientId: manager.id, type: REVIEW_REMINDER_NOTIFICATION_TYPE, message, link },
        });
        recipients++;
      } catch (err) {
        console.error("[review-reminders] Manager reminder failed:", err);
      }
    }

    recipients += await notifyOversight({
      employeeId: employee.id,
      subject: `Review coming up: ${name}'s ${milestone.label} (due ${dueLabel})`,
      message: `${name}'s ${milestone.label} is due on ${dueLabel} and is not scheduled yet.`,
      link,
      excludeEmployeeIds: [manager?.id],
    });

    await db.reviewMilestoneReminder.update({ where: { milestoneKey: milestone.key }, data: { recipients } });
    results.push({ milestoneKey: milestone.key, employee: employee.id, status: "sent", recipients });
  }

  return { todayKey, checkedMilestones: milestones.length, due: due.length, results };
}
