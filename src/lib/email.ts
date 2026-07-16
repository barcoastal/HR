import { Resend } from "resend";

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

function wrapHtml(content: string, companyName: string, logoUrl: string | null): string {
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
    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af">This is an automated message — please do not reply to this email.</p>
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

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }
  const branding = await getCompanyBranding();
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const finalSubject = withNoReplySubject(subject);
  console.log(`[email] Sending from: "${from}" to: ${to}`);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: finalSubject,
      html: wrapHtml(html, branding.companyName, branding.logoUrl),
    });
    if (error) {
      console.error(`[email] Resend error for ${to}: "${finalSubject}"`, error);
    } else {
      console.log(`[email] Sent to ${to}: "${finalSubject}"`, data);
    }
  } catch (error) {
    console.error(`[email] Failed to send to ${to}: "${finalSubject}"`, error);
  }
}

export async function sendEmailWithAttachments(
  to: string,
  subject: string,
  html: string,
  attachments: { filename: string; content: Buffer }[]
) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }
  const branding = await getCompanyBranding();
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const finalSubject = withNoReplySubject(subject);
  console.log(`[email] Sending with ${attachments.length} attachment(s) from: "${from}" to: ${to}`);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: finalSubject,
      html: wrapHtml(html, branding.companyName, branding.logoUrl),
      attachments,
    });
    if (error) {
      console.error(`[email] Resend error for ${to}: "${finalSubject}"`, error);
    } else {
      console.log(`[email] Sent to ${to}: "${finalSubject}"`, data);
    }
  } catch (error) {
    console.error(`[email] Failed to send to ${to}: "${finalSubject}"`, error);
  }
}

export async function sendTestEmail(to: string, type: string, subject: string, body: string) {
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

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
  };

  const interpolatedSubject = interpolate(subject, sampleVars);
  const interpolatedBody = interpolate(body, sampleVars);

  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  console.log(`[email] Test email from: "${from}" to: ${to}`);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: withNoReplySubject(`[TEST] ${interpolatedSubject}`),
      html: wrapHtml(interpolatedBody, branding.companyName, branding.logoUrl),
    });
    if (error) {
      console.error(`[email] Resend test email error:`, error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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
  to, assigneeName, newHireName, taskTitle, taskDescription,
}: {
  to: string; assigneeName: string; newHireName: string;
  taskTitle: string; taskDescription?: string | null;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("TASK_ASSIGNMENT")]);
  const vars = { assigneeName, newHireName, taskTitle, taskDescription: taskDescription || "", companyName: branding.companyName, logoUrl: branding.logoUrl || "" };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Onboarding task assigned: ${taskTitle}`, `
      <p>Hi ${assigneeName},</p>
      <p>You've been assigned to help <strong>${newHireName}</strong> with:</p>
      <p><strong>${taskTitle}</strong></p>
      ${taskDescription ? `<p>${taskDescription}</p>` : ""}
    `);
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
  to, firstName, interviewType, positionTitle, scheduledAt, duration, meetLink, notes,
}: {
  to: string; firstName: string; interviewType: string; positionTitle: string;
  scheduledAt: Date; duration: number; meetLink?: string | null; notes?: string | null;
}) {
  const [branding, template] = await Promise.all([
    getCompanyBranding(),
    getTemplate("INTERVIEW_SCHEDULED"),
  ]);

  const date = scheduledAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  // Optional pieces are passed as ready HTML (or "") — the interpolate()
  // conditional stripper removes {{#var}} blocks even when the var is set,
  // so templates can't rely on conditionals.
  const meetLinkHtml = meetLink
    ? `<p style="margin-top:16px"><a href="${meetLink}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Join Google Meet</a></p>`
    : "";
  const notesHtml = notes
    ? `<p style="margin-top:12px;color:#666"><em>Notes: ${notes}</em></p>`
    : "";

  const vars: Record<string, string> = {
    firstName,
    interviewType,
    positionTitle,
    date,
    time,
    duration: String(duration),
    meetLink: meetLink || "",
    meetLinkHtml,
    notesHtml,
    companyName: branding.companyName,
    logoUrl: branding.logoUrl || "",
  };

  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Interview Scheduled: ${interviewType}`, `
      <p>Hi ${firstName},</p>
      <p>Your <strong>${interviewType}</strong> for the <strong>${positionTitle}</strong> position has been scheduled.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0"><strong>Date:</strong> ${date}</p>
        <p style="margin:4px 0 0"><strong>Time:</strong> ${time}</p>
        <p style="margin:4px 0 0"><strong>Duration:</strong> ${duration} minutes</p>
      </div>
      ${meetLinkHtml}
      ${notesHtml}
      <p style="margin-top:16px">We look forward to speaking with you!</p>
    `);
  }
}

export async function sendAdverseActionEmail({
  to, firstName, positionTitle, reason,
}: {
  to: string; firstName: string; positionTitle?: string; reason?: string;
}) {
  const [branding, template] = await Promise.all([getCompanyBranding(), getTemplate("BACKGROUND_ADVERSE" as never)]);
  const vars = {
    firstName,
    positionTitle: positionTitle || "the position you applied for",
    reason: reason || "information revealed by your background report",
    companyName: branding.companyName,
    logoUrl: branding.logoUrl || "",
  };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(
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
      `
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
