import { Resend } from "resend";
import { IS_SANDBOX } from "@/lib/sandbox";
import { db } from "@/lib/db";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-defaults";
import { buildIcsInvite } from "@/lib/ics";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function getTemplate(type: string): Promise<{ subject: string; body: string } | null> {
  try {
    const { getEmailTemplate } = await import("@/lib/actions/email-templates");
    const { EMAIL_TEMPLATE_DEFAULTS } = await import("@/lib/email-template-defaults");
    if (!(type in EMAIL_TEMPLATE_DEFAULTS)) return null;
    return await getEmailTemplate(type as keyof typeof EMAIL_TEMPLATE_DEFAULTS);
  } catch {
    return null;
  }
}

const DEFAULT_SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply@hr.coastaldebt-tools.com";
const DEFAULT_SENDER_NAME = "Coastal HR";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getCompanyBranding(): Promise<{ companyName: string; logoUrl: string | null; senderEmail: string; senderName: string }> {
  try {
    const { db } = await import("@/lib/db");
    const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    // If DB still has the old Resend test domain, treat it as unset
    const dbEmail = settings?.senderEmail?.trim();
    const senderEmail = dbEmail && isValidEmail(dbEmail) && !dbEmail.endsWith("@resend.dev")
      ? dbEmail
      : DEFAULT_SENDER_EMAIL;
    console.log(`[email] Branding loaded — senderEmail: ${senderEmail}, dbValue: ${settings?.senderEmail}`);
    return {
      companyName: settings?.companyName || "Coastal HR",
      logoUrl: settings?.logoUrl ? `${baseUrl}${settings.logoUrl}` : null,
      senderEmail,
      senderName: settings?.senderName || settings?.companyName || DEFAULT_SENDER_NAME,
    };
  } catch (e) {
    console.error("[email] Failed to load branding:", e);
    return { companyName: "Coastal HR", logoUrl: null, senderEmail: DEFAULT_SENDER_EMAIL, senderName: DEFAULT_SENDER_NAME };
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  // Remove unused mustache conditionals
  result = result.replace(/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/g, "");
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wrapHtml(
  content: string,
  companyName: string,
  logoUrl: string | null,
  replyTo?: string,
  replyToName?: string
): string {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;max-width:180px;display:block" />`
    : `<span style="font-size:20px;font-weight:700;color:#3052FF">${companyName}</span>`;

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="padding:24px 24px 16px;border-bottom:1px solid #e5e7eb">
    ${logoHtml}
  </div>
  <div style="padding:24px">
    ${content}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280">${
      replyTo
        ? `Questions? Reply to contact ${escapeHtml(replyToName || replyTo)}.`
        : "This is an automated message. Please do not reply to this email."
    }</p>
    <p style="margin:0;font-size:12px;color:#9ca3af">${companyName} &middot; Sent via Coastal HR</p>
  </div>
</div>`;
}

const NO_REPLY_PREFIX = "[Do Not Reply]";

function withNoReplySubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^\[?\s*(do not reply|no[\s-]?reply)\b/i.test(trimmed)) return trimmed;
  return `${NO_REPLY_PREFIX} ${trimmed}`;
}

export type EmailDeliveryContext = {
  contextType?: string;
  contextId?: string;
  senderEmployeeId?: string | null;
  fromName?: string;
  replyTo?: string;
};

type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailSendResult = {
  success: boolean;
  status: "SENT" | "FAILED" | "SUPPRESSED";
  providerId?: string;
  deliveryId?: string;
  error?: string;
};

async function currentSenderEmployeeId(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  try {
    const { getSession } = await import("@/lib/auth-helpers");
    const session = await getSession();
    return session?.user?.employeeId || null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "Email provider rejected the message");
  }
  return String(error || "Email provider rejected the message");
}

async function notifySenderOfFailure(
  senderEmployeeId: string | null,
  recipient: string,
  subject: string,
  reason: string
) {
  if (!senderEmployeeId) return;
  try {
    await db.notification.create({
      data: {
        recipientId: senderEmployeeId,
        type: "EMAIL_DELIVERY_FAILED",
        message: `Email to ${recipient} failed: ${subject}. ${reason}`,
        link: "/notifications",
      },
    });
  } catch (notificationError) {
    console.error("[email] Failed to create delivery-failure notification:", notificationError);
  }
}

/** True when `to` belongs to an offboarded or archived employee, or a deactivated login. */
async function isDeactivatedRecipient(to: string): Promise<boolean> {
  const email = to.trim();
  if (!email) return false;
  const where = { email: { equals: email, mode: "insensitive" as const } };
  const [user, employee, archived] = await Promise.all([
    db.user.findFirst({ where, select: { deactivatedAt: true } }),
    db.employee.findFirst({ where, select: { status: true } }),
    db.employee.findFirst({ where: { ...where, archivedAt: { not: null } }, select: { id: true } }),
  ]);
  if (user?.deactivatedAt) return true;
  if (employee) return employee.status === "OFFBOARDED";
  return !!archived;
}

async function sendTrackedEmail(
  to: string,
  subject: string,
  html: string,
  attachments: EmailAttachment[] | undefined,
  context: EmailDeliveryContext = {}
): Promise<EmailSendResult> {
  const safeReplyTo = context.replyTo && isValidEmail(context.replyTo.trim())
    ? context.replyTo.trim()
    : undefined;
  const finalSubject = safeReplyTo ? subject.trim() : withNoReplySubject(subject);
  const senderEmployeeId = await currentSenderEmployeeId(context.senderEmployeeId);
  let deliveryId: string | undefined;

  // Central guard: nothing goes to a person who has been offboarded, archived or deactivated,
  // no matter which feature is sending. Recorded as SUPPRESSED so the Email Log shows why.
  if (await isDeactivatedRecipient(to)) {
    console.warn(`[email] Suppressed — recipient is deactivated: ${to} (${finalSubject})`);
    try {
      const delivery = await db.emailDelivery.create({
        data: {
          recipient: to,
          subject: finalSubject,
          status: "SUPPRESSED",
          error: "Recipient is deactivated",
          senderEmployeeId,
          contextType: context.contextType || null,
          contextId: context.contextId || null,
        },
        select: { id: true },
      });
      deliveryId = delivery.id;
    } catch (trackingError) {
      console.error("[email] Could not create delivery record:", trackingError);
    }
    return { success: false, status: "SUPPRESSED", error: "Recipient is deactivated", deliveryId };
  }

  try {
    const delivery = await db.emailDelivery.create({
      data: {
        recipient: to,
        subject: finalSubject,
        status: "QUEUED",
        senderEmployeeId,
        contextType: context.contextType || null,
        contextId: context.contextId || null,
      },
      select: { id: true },
    });
    deliveryId = delivery.id;
  } catch (trackingError) {
    console.error("[email] Could not create delivery record:", trackingError);
  }

  if (IS_SANDBOX) {
    console.log(`[sandbox] email suppressed — to: ${to}, subject: "${finalSubject}"`);
    if (deliveryId) {
      await db.emailDelivery.update({ where: { id: deliveryId }, data: { status: "SUPPRESSED" } }).catch(() => undefined);
    }
    return { success: true, status: "SUPPRESSED", deliveryId };
  }

  if (!resend) {
    const reason = "RESEND_API_KEY is not configured";
    console.warn(`[email] ${reason} — skipping email to ${to}: "${finalSubject}"`);
    if (deliveryId) {
      await db.emailDelivery.update({
        where: { id: deliveryId },
        data: { status: "FAILED", error: reason, failedAt: new Date() },
      }).catch(() => undefined);
    }
    await notifySenderOfFailure(senderEmployeeId, to, finalSubject, reason);
    return { success: false, status: "FAILED", error: reason, deliveryId };
  }

  const branding = await getCompanyBranding();
  const senderName = (context.fromName || branding.senderName).replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  console.log(`[email] Sending${attachments?.length ? ` with ${attachments.length} attachment(s)` : ""} from: "${from}" to: ${to}`);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: finalSubject,
      html: wrapHtml(html, branding.companyName, branding.logoUrl, safeReplyTo, senderName),
      ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
    if (error) throw error;

    const providerId = data?.id;
    if (deliveryId) {
      await db.emailDelivery.update({
        where: { id: deliveryId },
        data: { providerId, status: "SENT", sentAt: new Date(), error: null },
      }).catch((trackingError) => console.error("[email] Could not update delivery record:", trackingError));
    }
    console.log(`[email] Provider accepted email to ${to}: "${finalSubject}"`, data);
    return { success: true, status: "SENT", providerId, deliveryId };
  } catch (error) {
    const reason = errorMessage(error);
    console.error(`[email] Failed to send to ${to}: "${finalSubject}"`, error);
    if (deliveryId) {
      await db.emailDelivery.update({
        where: { id: deliveryId },
        data: { status: "FAILED", error: reason, failedAt: new Date() },
      }).catch(() => undefined);
    }
    await notifySenderOfFailure(senderEmployeeId, to, finalSubject, reason);
    return { success: false, status: "FAILED", error: reason, deliveryId };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  context?: EmailDeliveryContext
): Promise<EmailSendResult> {
  return sendTrackedEmail(to, subject, html, undefined, context);
}

export async function sendEmailWithAttachments(
  to: string,
  subject: string,
  html: string,
  attachments: EmailAttachment[],
  context?: EmailDeliveryContext
): Promise<EmailSendResult> {
  return sendTrackedEmail(to, subject, html, attachments, context);
}

export async function sendTestEmail(to: string, type: string, subject: string, body: string) {
  const branding = await getCompanyBranding();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const sampleVars: Record<string, string> = {
    companyName: branding.companyName,
    logoUrl: branding.logoUrl || "",
    firstName: "John",
    role: "Employee",
    loginUrl: `${baseUrl}/login`,
    documentName: "Employee Handbook",
    signingUrl: `${baseUrl}/sign/test-token`,
    assigneeName: "Sarah Smith",
    newHireName: "John Doe",
    taskTitle: "Complete I-9 Form",
    taskDescription: "Please complete the I-9 employment eligibility form.",
    workflowName: "Onboarding",
    body: "Welcome to the team! We're excited to have you.",
    documentUrl: `${baseUrl}/docs/sample.pdf`,
    subject: "Welcome to " + branding.companyName,
    interviewType: "Video Interview",
    positionTitle: "Sales Representative",
    date: "Monday, July 20, 2026",
    time: "2:00 PM",
    duration: "45",
    meetLink: "https://meet.google.com/abc-defg-hij",
    meetLinkHtml: `<p style="margin-top:16px"><a href="https://meet.google.com/abc-defg-hij" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Join Google Meet</a></p>`,
    notesHtml: `<p style="margin-top:12px;color:#666"><em>Notes: Please have your portfolio ready.</em></p>`,
    recruiterName: "Sarah Smith",
    recruiterEmail: "sarah.smith@example.com",
    timeZone: "EDT",
    calendarResponseHtml: `<p style="margin-top:16px;color:#374151">Use the attached calendar invitation to accept, tentatively accept, or decline.</p>`,
  };

  const interpolatedSubject = interpolate(subject, sampleVars);
  const interpolatedBody = interpolate(body, sampleVars);

  const result = await sendTrackedEmail(
    to,
    `[TEST] ${interpolatedSubject}`,
    interpolatedBody,
    undefined,
    { contextType: "EMAIL_TEMPLATE_TEST", contextId: type },
  );

  if (result.status === "SUPPRESSED") {
    return { success: false, error: "Sandbox mode: outbound email is disabled in this environment" };
  }
  return result.success
    ? { success: true }
    : { success: false, error: result.error || "Email provider rejected the message" };
}

export async function sendOnboardingEmail({
  to, subject, body, documentUrl, documentName,
}: {
  to: string; subject: string; body: string;
  documentUrl?: string | null; documentName?: string | null;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("ONBOARDING")]);
  const vars: Record<string, string> = {
    subject, body, companyName: branding.companyName, logoUrl: branding.logoUrl || "",
  };
  if (documentUrl) vars.documentUrl = documentUrl;
  if (documentName) vars.documentName = documentName;

  if (template) {
    const html = interpolate(template.body, vars);
    const subj = interpolate(template.subject, vars);
    await sendEmail(to, subj, html);
  } else {
    const documentLink =
      documentUrl && documentName
        ? `<p style="margin-top:16px"><a href="${documentUrl}" style="color:#4f46e5;text-decoration:underline">Download: ${documentName}</a></p>`
        : "";
    await sendEmail(to, subject, `<div style="white-space:pre-wrap">${body}</div>${documentLink}`);
  }
}

export async function sendSigningRequestEmail({
  to, firstName, documentName, signingUrl,
}: {
  to: string; firstName: string; documentName: string; signingUrl: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("SIGNING_REQUEST")]);
  const vars = { firstName, documentName, signingUrl, companyName: branding.companyName, logoUrl: branding.logoUrl || "" };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Please sign: ${documentName}`, `
      <p>Hi ${firstName},</p>
      <p>Please review and sign <strong>${documentName}</strong> for your onboarding at ${branding.companyName}.</p>
      <p><a href="${signingUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Review & Sign Document</a></p>
      <p>This link expires in 30 days.</p>
    `);
  }
}

export async function sendTaskAssignmentEmail({
  to, assigneeName, newHireName, taskTitle, taskDescription, taskId, taskUrl, workflowName = "Onboarding",
}: {
  to: string; assigneeName: string; newHireName: string;
  taskTitle: string; taskDescription?: string | null;
  taskId?: string; taskUrl?: string; workflowName?: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("TASK_ASSIGNMENT")]);
  const vars = { assigneeName, newHireName, taskTitle, taskDescription: taskDescription || "", taskUrl: taskUrl || "", workflowName, companyName: branding.companyName, logoUrl: branding.logoUrl || "" };
  const context: EmailDeliveryContext = { contextType: "TASK_ASSIGNMENT", contextId: taskId };
  if (template) {
    return sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars), context);
  } else {
    return sendEmail(to, `${workflowName} task assigned: ${taskTitle}`, `
      <p>Hi ${assigneeName},</p>
      <p>You've been assigned to help <strong>${newHireName}</strong> with:</p>
      <p><strong>${taskTitle}</strong></p>
      ${taskDescription ? `<p>${taskDescription}</p>` : ""}
      ${taskUrl ? `<p><a href="${taskUrl}" style="display:inline-block;padding:10px 18px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">View assigned task</a></p>` : ""}
    `, context);
  }
}

export async function sendWelcomeEmail({
  to, role, loginUrl,
}: {
  to: string; role: string; loginUrl: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("WELCOME")]);
  const vars = { role, loginUrl, companyName: branding.companyName, logoUrl: branding.logoUrl || "" };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Welcome to ${branding.companyName}`, `
      <h2 style="color:#1a1a2e;margin-bottom:16px">Welcome to ${branding.companyName}!</h2>
      <p>You've been invited to join ${branding.companyName} as <strong>${role}</strong>.</p>
      <p>Sign in with your Google account to get started:</p>
      <p style="margin:24px 0">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Sign In</a>
      </p>
      <p style="color:#666;font-size:14px">If you have any questions, reach out to your HR administrator.</p>
    `);
  }
}

export async function sendInterviewScheduledEmail({
  to,
  firstName,
  lastName,
  interviewId,
  interviewType,
  positionTitle,
  scheduledAt,
  duration,
  interviewerName,
  interviewerEmail,
  interviewerEmployeeId,
  meetLink,
  location,
  notes,
  timeZone = process.env.COMPANY_TIME_ZONE || "America/New_York",
}: {
  to: string;
  firstName: string;
  lastName?: string;
  interviewId: string;
  interviewType: string;
  positionTitle: string;
  scheduledAt: Date;
  duration: number;
  interviewerName: string;
  interviewerEmail: string;
  interviewerEmployeeId?: string | null;
  meetLink?: string | null;
  /** Onsite interviews: address or office / room. Rendered as a "Location:" line. */
  location?: string | null;
  notes?: string | null;
  timeZone?: string;
}) {
  const [branding, template] = await Promise.all([
    getCompanyBranding(),
    getTemplate("INTERVIEW_SCHEDULED"),
  ]);

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(scheduledAt);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(scheduledAt);
  const meetLinkHtml = meetLink
    ? `<p style="margin-top:16px"><a href="${escapeHtml(meetLink)}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Join Google Meet</a></p>`
    : "";
  const locationHtml = location
    ? `<p style="margin-top:12px;color:#374151"><strong>Location:</strong> ${escapeHtml(location)}</p>`
    : "";
  const notesHtml = notes
    ? `<p style="margin-top:12px;color:#4b5563"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`
    : "";
  const calendarResponseHtml = `<p style="margin-top:16px;color:#374151">A calendar invitation is attached. Use your email or calendar app to accept, tentatively accept, or decline.</p>`;

  const plainVars: Record<string, string> = {
    firstName,
    interviewType,
    positionTitle,
    date,
    time,
    duration: String(duration),
    timeZone,
    recruiterName: interviewerName,
    recruiterEmail: interviewerEmail,
    meetLink: meetLink || "",
    location: location || "",
    companyName: branding.companyName,
    logoUrl: branding.logoUrl || "",
  };
  const bodyVars: Record<string, string> = {
    ...Object.fromEntries(Object.entries(plainVars).map(([key, value]) => [key, escapeHtml(value)])),
    logoUrl: branding.logoUrl || "",
    meetLinkHtml,
    locationHtml,
    notesHtml,
    calendarResponseHtml,
  };
  const calendarDescription = [
    `${interviewType} for ${positionTitle}`,
    `Interviewer: ${interviewerName} (${interviewerEmail})`,
    `Duration: ${duration} minutes`,
    location ? `Location: ${location}` : "",
    meetLink ? `Join: ${meetLink}` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join("\n");
  const organizerEmail = isValidEmail(interviewerEmail)
    ? interviewerEmail
    : branding.senderEmail;
  const calendarInvite = buildIcsInvite({
    uid: `${interviewId}@calatrava-hr`,
    start: scheduledAt,
    durationMinutes: duration,
    summary: `${interviewType}: ${positionTitle}`,
    description: calendarDescription,
    location: location || meetLink || undefined,
    organizerEmail,
    organizerName: interviewerName,
    attendees: [{ email: to, name: `${firstName} ${lastName || ""}`.trim() }],
  });
  const attachments: EmailAttachment[] = [{
    filename: "interview-invitation.ics",
    content: calendarInvite,
    contentType: "text/calendar; method=REQUEST; charset=utf-8",
  }];
  const context: EmailDeliveryContext = {
    contextType: "INTERVIEW_INVITATION",
    contextId: interviewId,
    senderEmployeeId: interviewerEmployeeId,
    fromName: `${interviewerName} via ${branding.companyName}`,
    replyTo: isValidEmail(interviewerEmail) ? interviewerEmail : undefined,
  };

  if (template) {
    let templateBody = interpolate(template.body, bodyVars);
    const requiredDetails = [
      ["Interview", interviewType],
      ["Position", positionTitle],
      ["Date", date],
      ["Time", time],
      ["Duration", `${duration} minutes`],
      ["Interviewer", interviewerName],
    ].filter(([, value]) => !templateBody.includes(escapeHtml(value)));
    if (requiredDetails.length > 0) {
      templateBody += `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">${requiredDetails
        .map(([label, value], index) => `<p style="margin:${index === 0 ? "0" : "4px 0 0"}"><strong>${label}:</strong> ${escapeHtml(value)}</p>`)
        .join("")}</div>`;
    }
    if (meetLink && !templateBody.includes(escapeHtml(meetLink))) templateBody += meetLinkHtml;
    if (location && !templateBody.includes(escapeHtml(location))) templateBody += locationHtml;
    if (notes && !templateBody.includes(escapeHtml(notes))) templateBody += notesHtml;
    if (!templateBody.includes("calendar invitation is attached")) templateBody += calendarResponseHtml;
    return sendEmailWithAttachments(
      to,
      interpolate(template.subject, plainVars),
      templateBody,
      attachments,
      context
    );
  }

  return sendEmailWithAttachments(to, `Interview Scheduled: ${interviewType}`, `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your <strong>${escapeHtml(interviewType)}</strong> for the <strong>${escapeHtml(positionTitle)}</strong> position has been scheduled.</p>
    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0"><strong>Date:</strong> ${escapeHtml(date)}</p>
      <p style="margin:4px 0 0"><strong>Time:</strong> ${escapeHtml(time)}</p>
      <p style="margin:4px 0 0"><strong>Duration:</strong> ${duration} minutes</p>
      <p style="margin:4px 0 0"><strong>Interviewer:</strong> ${escapeHtml(interviewerName)}</p>
    </div>
    ${meetLinkHtml}
    ${locationHtml}
    ${notesHtml}
    ${calendarResponseHtml}
    <p style="margin-top:16px">We look forward to speaking with you!</p>
  `, attachments, context);
}

export async function sendPreAdverseActionEmail({
  to, firstName, positionTitle, reason, responseDueAt, report, candidateId,
}: {
  to: string;
  firstName: string;
  positionTitle?: string;
  reason?: string;
  responseDueAt: Date;
  report: Buffer;
  candidateId: string;
}) {
  const [branding, template] = await Promise.all([
    getCompanyBranding(),
    getTemplate("BACKGROUND_PRE_ADVERSE"),
  ]);
  const rightsSummaryUrl = "https://www.consumerfinance.gov/rules-policy/regulations/1022/k/";
  const vars = {
    firstName: escapeHtml(firstName),
    positionTitle: escapeHtml(positionTitle || "the position you applied for"),
    reason: escapeHtml(reason || "information contained in your background report"),
    responseDueDate: responseDueAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    rightsSummaryUrl,
    companyName: escapeHtml(branding.companyName),
    logoUrl: branding.logoUrl || "",
  };
  const subject = template?.subject || "Important notice regarding your background report";
  const body = template?.body || EMAIL_TEMPLATE_DEFAULTS.BACKGROUND_PRE_ADVERSE.body;
  return sendEmailWithAttachments(
    to,
    interpolate(subject, vars),
    interpolate(body, vars),
    [{ filename: "background-report.pdf", content: report }],
    { contextType: "PRE_ADVERSE_ACTION", contextId: candidateId }
  );
}

export async function sendAdverseActionEmail({
  to, firstName, positionTitle, reason, candidateId,
}: {
  to: string; firstName: string; positionTitle?: string; reason?: string; candidateId: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("BACKGROUND_ADVERSE")]);
  const vars = {
    firstName: escapeHtml(firstName),
    positionTitle: escapeHtml(positionTitle || "the position you applied for"),
    reason: escapeHtml(reason || "information revealed by your background report"),
    companyName: escapeHtml(branding.companyName),
    logoUrl: branding.logoUrl || "",
  };
  if (template) {
    return sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars), {
      contextType: "ADVERSE_ACTION",
      contextId: candidateId,
    });
  } else {
    return sendEmail(
      to,
      `Update on your application to ${branding.companyName}`,
      `
        <p>Dear ${firstName},</p>
        <p>Thank you for your interest in <strong>${vars.positionTitle}</strong> at ${branding.companyName}.</p>
        <p>After careful review of your application, including the results of your background check, we have decided not to move forward with your candidacy at this time. This decision was based, in whole or in part, on ${vars.reason}.</p>
        <p>You have the right to obtain a free copy of the background report from the consumer reporting agency that prepared it, and to dispute any information you believe to be inaccurate or incomplete directly with that agency. A <em>Summary of Your Rights Under the Fair Credit Reporting Act</em> is available upon request.</p>
        <p>We appreciate the time you invested in the application process and wish you success in your job search.</p>
        <p>Sincerely,<br/>The ${branding.companyName} team</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#666;font-size:11px">This notice is being sent in compliance with the federal Fair Credit Reporting Act and any applicable state or local law.</p>
      `,
      { contextType: "ADVERSE_ACTION", contextId: candidateId }
    );
  }
}

export async function sendCountersignRequestEmail({
  to, firstName, documentName, signerName, countersignUrl,
}: {
  to: string; firstName: string; documentName: string; signerName: string; countersignUrl: string;
}) {
  const branding = await getCompanyBranding();
  await sendEmail(to, `Countersignature needed: ${documentName}`, `
    <p>Hi ${firstName},</p>
    <p><strong>${signerName}</strong> has signed <strong>${documentName}</strong>. It now needs your countersignature to be complete.</p>
    <p><a href="${countersignUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Review & Countersign</a></p>
    <p style="color:#666;font-size:13px">You can also review all pending countersignatures from the Sign Queue in ${branding.companyName}.</p>
  `);
}

export async function sendCountersignCompletedEmail({
  to, firstName, documentName,
}: {
  to: string; firstName: string; documentName: string;
}) {
  const branding = await getCompanyBranding();
  await sendEmail(to, `Document fully signed: ${documentName}`, `
    <p>Hi ${firstName},</p>
    <p><strong>${documentName}</strong> has been countersigned by ${branding.companyName} and is now fully executed.</p>
    <p>A copy is available in your documents page.</p>
  `);
}

export async function sendFillRequestEmail({
  to, firstName, documentName, fillUrl,
}: {
  to: string; firstName: string; documentName: string; fillUrl: string;
}) {
  const branding = await getCompanyBranding();
  await sendEmail(to, `Please complete: ${documentName}`, `
    <p>Hi ${firstName},</p>
    <p>Please fill out <strong>${documentName}</strong> for your onboarding at ${branding.companyName}.</p>
    <p><a href="${fillUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Fill Out Document</a></p>
    <p>This link expires in 30 days.</p>
  `);
}

export async function sendFillConfirmationEmail({
  to, firstName, documentName,
}: {
  to: string; firstName: string; documentName: string;
}) {
  const branding = await getCompanyBranding();
  await sendEmail(to, `Document completed: ${documentName}`, `
    <p>Hi ${firstName},</p>
    <p>Thanks for completing <strong>${documentName}</strong>. A copy has been saved to your file.</p>
  `);
}

export async function sendSigningConfirmationEmail({
  to, firstName, documentName,
}: {
  to: string; firstName: string; documentName: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("SIGNING_CONFIRMATION")]);
  const vars = { firstName, documentName, companyName: branding.companyName, logoUrl: branding.logoUrl || "" };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Document signed: ${documentName}`, `
      <p>Hi ${firstName},</p>
      <p>Thanks for signing <strong>${documentName}</strong>. A copy has been saved to your file.</p>
    `);
  }
}

export async function sendFeedPostNotification(
  recipients: string[],
  subject: string,
  bodyHtml: string
) {
  if (IS_SANDBOX) {
    console.log(`[sandbox] feed notification suppressed — ${recipients.length} recipients`);
    return;
  }
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping feed notification`);
    return;
  }

  const branding = await getCompanyBranding();
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const html = wrapHtml(bodyHtml, branding.companyName, branding.logoUrl);

  // Chunk into batches of 100 (Resend batch limit)
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(
        chunk.map((to) => ({ from, to, subject, html }))
      );
      console.log(
        `[email] Feed notification batch sent: ${chunk.length} recipients`
      );
    } catch (error) {
      console.error(`[email] Feed notification batch error:`, error);
    }
  }
}
