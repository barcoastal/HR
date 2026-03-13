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

async function getCompanyBranding(): Promise<{ companyName: string; logoUrl: string | null; senderEmail: string; senderName: string }> {
  try {
    const { db } = await import("@/lib/db");
    const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return {
      companyName: settings?.companyName || "Coastal HR",
      logoUrl: settings?.logoUrl ? `${baseUrl}${settings.logoUrl}` : null,
      senderEmail: settings?.senderEmail || "onboarding@resend.dev",
      senderName: settings?.senderName || settings?.companyName || "Coastal HR",
    };
  } catch {
    return { companyName: "Coastal HR", logoUrl: null, senderEmail: "onboarding@resend.dev", senderName: "Coastal HR" };
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
    <p style="margin:0;font-size:12px;color:#9ca3af">${companyName} &middot; Sent via Coastal HR</p>
  </div>
</div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }
  const branding = await getCompanyBranding();
  try {
    await resend.emails.send({
      from: `${branding.senderName} <${branding.senderEmail}>`,
      to,
      subject,
      html: wrapHtml(html, branding.companyName, branding.logoUrl),
    });
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
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
  };

  const interpolatedSubject = interpolate(subject, sampleVars);
  const interpolatedBody = interpolate(body, sampleVars);

  try {
    await resend.emails.send({
      from: `${branding.companyName} <${branding.senderEmail}>`,
      to,
      subject: `[TEST] ${interpolatedSubject}`,
      html: wrapHtml(interpolatedBody, branding.companyName, branding.logoUrl),
    });
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
  const branding = await getCompanyBranding();
  const template = await getTemplate("ONBOARDING");
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
  const branding = await getCompanyBranding();
  const template = await getTemplate("SIGNING_REQUEST");
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
  const branding = await getCompanyBranding();
  const template = await getTemplate("TASK_ASSIGNMENT");
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
  const branding = await getCompanyBranding();
  const template = await getTemplate("WELCOME");
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

export async function sendSigningConfirmationEmail({
  to, firstName, documentName,
}: {
  to: string; firstName: string; documentName: string;
}) {
  const branding = await getCompanyBranding();
  const template = await getTemplate("SIGNING_CONFIRMATION");
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
