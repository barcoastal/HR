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
  batchSize = 8,
  delayBetweenBatchesMs = 1100,
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
    // Respect Resend's per-second rate limit. Skip the sleep after the last batch.
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatchesMs));
    }
  }

  return { succeeded, failed };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string | null | undefined): email is string {
  return !!email && EMAIL_RE.test(email.trim());
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
    select: { firstName: true, lastName: true, email: true, phone: true },
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

  type RecipientLog = { name: string; email: string; reason: string };
  const skippedRecipients: RecipientLog[] = [];
  const failedRecipients: RecipientLog[] = [];

  // Partition employees by whether they have a usable email address. Anything
  // we can't send to is logged as "skipped" with the reason — never counted
  // as a silent send failure.
  const validRecipients: typeof employees = [];
  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    if (!emp.email || emp.email.trim().length === 0) {
      skippedRecipients.push({ name, email: "", reason: "No email on file" });
      continue;
    }
    if (!isValidEmail(emp.email)) {
      skippedRecipients.push({ name, email: emp.email, reason: "Invalid email format" });
      continue;
    }
    validRecipients.push(emp);
  }

  if (skippedRecipients.length > 0) {
    console.warn(
      `[emergency] Skipped ${skippedRecipients.length} active employees without a valid email:`,
      skippedRecipients,
    );
  }

  // Emergency alerts use BCC chunking so everyone gets the email at the same
  // moment — one Resend API call per chunk instead of one per recipient. This
  // sidesteps the per-second rate limit entirely. Resend caps recipients at 50
  // per email, so we send in chunks of 49 (leaving one slot for the To
  // address, which we set to the sender so BCC-only sends aren't flagged as
  // spam).
  let emailSucceeded = 0;
  let emailFailed = 0;
  if (!resend) {
    for (const emp of validRecipients) {
      failedRecipients.push({
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        reason: "RESEND_API_KEY not configured",
      });
    }
    emailFailed = validRecipients.length;
  } else {
    const CHUNK = 49;
    const senderAddress = branding.senderEmail.trim();
    for (let i = 0; i < validRecipients.length; i += CHUNK) {
      const chunk = validRecipients.slice(i, i + CHUNK);
      const bccList = chunk.map((e) => e.email);
      try {
        const { error } = await resend.emails.send({
          from,
          to: senderAddress,
          bcc: bccList,
          subject: `[Do Not Reply] [EMERGENCY] ${title}`,
          html: emailHtml,
        });
        if (error) {
          const reason = error.message || (error as { name?: string }).name || "Resend rejected the send";
          console.error(`[emergency] Chunk ${i / CHUNK + 1} rejected:`, error);
          for (const emp of chunk) {
            failedRecipients.push({ name: `${emp.firstName} ${emp.lastName}`, email: emp.email, reason });
          }
          emailFailed += chunk.length;
        } else {
          emailSucceeded += chunk.length;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Network error";
        console.error(`[emergency] Chunk ${i / CHUNK + 1} threw:`, err);
        for (const emp of chunk) {
          failedRecipients.push({ name: `${emp.firstName} ${emp.lastName}`, email: emp.email, reason });
        }
        emailFailed += chunk.length;
      }
    }
  }
  const emailResults = { succeeded: emailSucceeded, failed: emailFailed };

  const withPhone = employees.filter((e) => e.phone);
  const smsBody = `[EMERGENCY] ${title}: ${message}`;

  const smsResults = await sendInBatches(withPhone, async (emp) => {
    return sendSMS(emp.phone!, smsBody);
  });

  const totalEmailIssues = emailResults.failed + skippedRecipients.length;
  const allSucceeded = totalEmailIssues === 0 && smsResults.failed === 0;

  await db.emergencyAlert.update({
    where: { id: alert.id },
    data: {
      emailsSent: emailResults.succeeded,
      emailsFailed: emailResults.failed,
      smsSent: smsResults.succeeded,
      smsFailed: smsResults.failed,
      failedRecipients: failedRecipients.length > 0 ? JSON.stringify(failedRecipients) : null,
      skippedRecipients: skippedRecipients.length > 0 ? JSON.stringify(skippedRecipients) : null,
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

/**
 * Audit active employees and return anyone who would silently fall off an
 * emergency alert (no email on file or invalid format). Called from the
 * Alerts page so HR can fix bad rows BEFORE sending a real blast.
 */
export async function getEmergencyAlertHealth() {
  const session = await requireAdmin();
  const role = session.user?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const missing: { id: string; name: string; email: string }[] = [];
  const invalid: { id: string; name: string; email: string }[] = [];
  for (const e of employees) {
    const name = `${e.firstName} ${e.lastName}`;
    if (!e.email || e.email.trim().length === 0) {
      missing.push({ id: e.id, name, email: "" });
    } else if (!isValidEmail(e.email)) {
      invalid.push({ id: e.id, name, email: e.email });
    }
  }
  return {
    totalActive: employees.length,
    reachable: employees.length - missing.length - invalid.length,
    missing,
    invalid,
  };
}
