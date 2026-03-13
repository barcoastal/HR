import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function getTemplate(type: string): Promise<{ subject: string; body: string } | null> {
  try {
    const { getEmailTemplate } = await import("@/lib/actions/email-templates");
    return await getEmailTemplate(type as "WELCOME" | "SIGNING_REQUEST" | "TASK_ASSIGNMENT" | "SIGNING_CONFIRMATION" | "ONBOARDING");
  } catch {
    return null;
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

function wrapHtml(content: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">${content}</div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html: wrapHtml(html),
    });
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
  }
}

export async function sendOnboardingEmail({
  to,
  subject,
  body,
  documentUrl,
  documentName,
}: {
  to: string;
  subject: string;
  body: string;
  documentUrl?: string | null;
  documentName?: string | null;
}) {
  const template = await getTemplate("ONBOARDING");
  if (template) {
    const vars: Record<string, string> = { subject, body };
    if (documentUrl) vars.documentUrl = documentUrl;
    if (documentName) vars.documentName = documentName;
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
  to,
  firstName,
  documentName,
  signingUrl,
}: {
  to: string;
  firstName: string;
  documentName: string;
  signingUrl: string;
}) {
  const template = await getTemplate("SIGNING_REQUEST");
  const vars = { firstName, documentName, signingUrl };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Please sign: ${documentName}`, `
      <p>Hi ${firstName},</p>
      <p>Please review and sign <strong>${documentName}</strong> for your onboarding.</p>
      <p><a href="${signingUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Review & Sign Document</a></p>
      <p>This link expires in 30 days.</p>
    `);
  }
}

export async function sendTaskAssignmentEmail({
  to,
  assigneeName,
  newHireName,
  taskTitle,
  taskDescription,
}: {
  to: string;
  assigneeName: string;
  newHireName: string;
  taskTitle: string;
  taskDescription?: string | null;
}) {
  const template = await getTemplate("TASK_ASSIGNMENT");
  const vars = { assigneeName, newHireName, taskTitle, taskDescription: taskDescription || "" };
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
  to,
  role,
  loginUrl,
}: {
  to: string;
  role: string;
  loginUrl: string;
}) {
  const template = await getTemplate("WELCOME");
  const vars = { role, loginUrl };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, "Welcome to Coastal HR", `
      <h2 style="color:#1a1a2e;margin-bottom:16px">Welcome to Coastal HR!</h2>
      <p>You've been invited to join the Coastal HR platform as <strong>${role}</strong>.</p>
      <p>Sign in with your Google account to get started:</p>
      <p style="margin:24px 0">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Sign In to Coastal HR</a>
      </p>
      <p style="color:#666;font-size:14px">If you have any questions, reach out to your HR administrator.</p>
    `);
  }
}

export async function sendSigningConfirmationEmail({
  to,
  firstName,
  documentName,
}: {
  to: string;
  firstName: string;
  documentName: string;
}) {
  const template = await getTemplate("SIGNING_CONFIRMATION");
  const vars = { firstName, documentName };
  if (template) {
    await sendEmail(to, interpolate(template.subject, vars), interpolate(template.body, vars));
  } else {
    await sendEmail(to, `Document signed: ${documentName}`, `
      <p>Hi ${firstName},</p>
      <p>Thanks for signing <strong>${documentName}</strong>. A copy has been saved to your file.</p>
    `);
  }
}
