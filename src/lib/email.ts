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
