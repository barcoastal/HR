import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`
    );
    return;
  }

  const documentLink =
    documentUrl && documentName
      ? `<p style="margin-top:16px"><a href="${documentUrl}" style="color:#4f46e5;text-decoration:underline">Download: ${documentName}</a></p>`
      : "";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="white-space:pre-wrap">${body}</div>
      ${documentLink}
    </div>
  `;

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping signing request email");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Please sign: ${documentName}`,
      html: `
        <p>Hi ${firstName},</p>
        <p>Please review and sign <strong>${documentName}</strong> for your onboarding.</p>
        <p><a href="${signingUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Review & Sign Document</a></p>
        <p>This link expires in 30 days.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send signing request email:", error);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping task assignment email");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Onboarding task assigned: ${taskTitle}`,
      html: `
        <p>Hi ${assigneeName},</p>
        <p>You've been assigned to help <strong>${newHireName}</strong> with:</p>
        <p><strong>${taskTitle}</strong></p>
        ${taskDescription ? `<p>${taskDescription}</p>` : ""}
      `,
    });
  } catch (error) {
    console.error("Failed to send task assignment email:", error);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping welcome email");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const r = new Resend(apiKey);
    await r.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: "Welcome to Coastal HR",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#1a1a2e;margin-bottom:16px">Welcome to Coastal HR!</h2>
          <p>You've been invited to join the Coastal HR platform as <strong>${role}</strong>.</p>
          <p>Sign in with your Google account to get started:</p>
          <p style="margin:24px 0">
            <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">
              Sign In to Coastal HR
            </a>
          </p>
          <p style="color:#666;font-size:14px">If you have any questions, reach out to your HR administrator.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Document signed: ${documentName}`,
      html: `
        <p>Hi ${firstName},</p>
        <p>Thanks for signing <strong>${documentName}</strong>. A copy has been saved to your file.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send signing confirmation email:", error);
  }
}
