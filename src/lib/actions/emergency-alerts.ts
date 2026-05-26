"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendSMS } from "@/lib/sms";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_SENDER_EMAIL =
  process.env.SENDER_EMAIL || "noreply@hr.coastaldebt-tools.com";

async function getCompanyBranding() {
  try {
    const settings = await db.companySettings.findUnique({
      where: { id: "singleton" },
    });
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return {
      companyName: settings?.companyName || "Coastal HR",
      logoUrl: settings?.logoUrl ? `${baseUrl}${settings.logoUrl}` : null,
      senderEmail: settings?.senderEmail || DEFAULT_SENDER_EMAIL,
      senderName: settings?.senderName || settings?.companyName || "Coastal HR",
    };
  } catch {
    return {
      companyName: "Coastal HR",
      logoUrl: null,
      senderEmail: DEFAULT_SENDER_EMAIL,
      senderName: "Coastal HR",
    };
  }
}

function buildEmergencyEmailHtml(
  title: string,
  message: string,
  companyName: string,
  logoUrl: string | null
) {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;max-width:180px;display:block" />`
    : `<span style="font-size:20px;font-weight:700;color:#EF4444">${companyName}</span>`;

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#EF4444;padding:16px 24px;text-align:center">
    <span style="color:white;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase">⚠ EMERGENCY ALERT</span>
  </div>
  <div style="padding:24px 24px 16px;border-bottom:1px solid #e5e7eb">
    ${logoHtml}
  </div>
  <div style="padding:24px">
    <h1 style="color:#1a1a27;font-size:22px;margin:0 0 16px">${title}</h1>
    <p style="color:#333;font-size:16px;line-height:1.6;white-space:pre-wrap;margin:0">${message}</p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">This is an emergency alert from ${companyName}</p>
  </div>
</div>`;
}

async function sendInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<boolean>,
  batchSize = 10
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) succeeded++;
      else failed++;
    }
  }

  return { succeeded, failed };
}

export async function sendEmergencyAlert(title: string, message: string) {
  const session = await requireAdmin();
  const role = session.user?.role;

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Only admins can send emergency alerts");
  }

  const employeeId = session.user?.employeeId;
  if (!employeeId) {
    throw new Error("No employee profile linked to your account");
  }

  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { email: true, phone: true },
  });

  const post = await db.feedPost.create({
    data: {
      authorId: employeeId,
      content: message,
      type: "EMERGENCY",
      pinned: true,
    },
  });

  const alert = await db.emergencyAlert.create({
    data: {
      feedPostId: post.id,
      title,
      sentById: employeeId,
      status: "SENDING",
    },
  });

  const branding = await getCompanyBranding();
  const emailHtml = buildEmergencyEmailHtml(
    title,
    message,
    branding.companyName,
    branding.logoUrl
  );
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const from = senderName
    ? `${senderName} <${branding.senderEmail}>`
    : branding.senderEmail;

  const emailResults = await sendInBatches(employees, async (emp) => {
    if (!resend) return false;
    try {
      const { error } = await resend.emails.send({
        from,
        to: emp.email,
        subject: `[Do Not Reply] [EMERGENCY] ${title}`,
        html: emailHtml,
      });
      return !error;
    } catch {
      return false;
    }
  });

  const withPhone = employees.filter((e) => e.phone);
  const smsBody = `[EMERGENCY] ${title}: ${message}`;

  const smsResults = await sendInBatches(withPhone, async (emp) => {
    return sendSMS(emp.phone!, smsBody);
  });

  const allSucceeded =
    emailResults.failed === 0 && smsResults.failed === 0;

  await db.emergencyAlert.update({
    where: { id: alert.id },
    data: {
      emailsSent: emailResults.succeeded,
      emailsFailed: emailResults.failed,
      smsSent: smsResults.succeeded,
      smsFailed: smsResults.failed,
      status: allSucceeded ? "SENT" : "PARTIALLY_FAILED",
    },
  });

  revalidatePath("/alerts");
  revalidatePath("/");

  return {
    emailsSent: emailResults.succeeded,
    emailsFailed: emailResults.failed,
    smsSent: smsResults.succeeded,
    smsFailed: smsResults.failed,
  };
}

export async function sendTestEmergencyAlert(
  title: string,
  message: string,
  testEmail: string
) {
  const session = await requireAdmin();
  const role = session.user?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Only admins can send emergency alerts");
  }
  if (!resend) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const branding = await getCompanyBranding();
  const emailHtml = buildEmergencyEmailHtml(
    title,
    message,
    branding.companyName,
    branding.logoUrl
  );
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const from = senderName
    ? `${senderName} <${branding.senderEmail}>`
    : branding.senderEmail;

  const { error } = await resend.emails.send({
    from,
    to: testEmail,
    subject: `[Do Not Reply] [TEST] [EMERGENCY] ${title}`,
    html: emailHtml,
  });

  if (error) {
    throw new Error(`Failed to send: ${error.message}`);
  }

  return { success: true };
}

export async function getEmergencyAlerts() {
  const session = await requireAdmin();
  const role = session.user?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  return db.emergencyAlert.findMany({
    include: {
      sentBy: { select: { firstName: true, lastName: true } },
      feedPost: { select: { content: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
