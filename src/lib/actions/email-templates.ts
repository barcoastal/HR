"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type EmailTemplateType =
  | "WELCOME"
  | "SIGNING_REQUEST"
  | "TASK_ASSIGNMENT"
  | "SIGNING_CONFIRMATION"
  | "ONBOARDING";

export const EMAIL_TEMPLATE_DEFAULTS: Record<
  EmailTemplateType,
  { subject: string; body: string; variables: string[]; description: string }
> = {
  WELCOME: {
    description: "Sent when a new user is invited to the platform",
    variables: ["role", "loginUrl"],
    subject: "Welcome to Coastal HR",
    body: `<h2 style="color:#1a1a2e;margin-bottom:16px">Welcome to Coastal HR!</h2>
<p>You've been invited to join the Coastal HR platform as <strong>{{role}}</strong>.</p>
<p>Sign in with your Google account to get started:</p>
<p style="margin:24px 0">
  <a href="{{loginUrl}}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Sign In to Coastal HR</a>
</p>
<p style="color:#666;font-size:14px">If you have any questions, reach out to your HR administrator.</p>`,
  },
  SIGNING_REQUEST: {
    description: "Sent when an employee needs to sign a document",
    variables: ["firstName", "documentName", "signingUrl"],
    subject: "Please sign: {{documentName}}",
    body: `<p>Hi {{firstName}},</p>
<p>Please review and sign <strong>{{documentName}}</strong> for your onboarding.</p>
<p style="margin:24px 0">
  <a href="{{signingUrl}}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Review & Sign Document</a>
</p>
<p style="color:#666;font-size:14px">This link expires in 30 days.</p>`,
  },
  TASK_ASSIGNMENT: {
    description: "Sent when an onboarding task is assigned to an employee",
    variables: ["assigneeName", "newHireName", "taskTitle", "taskDescription"],
    subject: "Onboarding task assigned: {{taskTitle}}",
    body: `<p>Hi {{assigneeName}},</p>
<p>You've been assigned to help <strong>{{newHireName}}</strong> with:</p>
<p><strong>{{taskTitle}}</strong></p>
<p>{{taskDescription}}</p>`,
  },
  SIGNING_CONFIRMATION: {
    description: "Sent after a document has been successfully signed",
    variables: ["firstName", "documentName"],
    subject: "Document signed: {{documentName}}",
    body: `<p>Hi {{firstName}},</p>
<p>Thanks for signing <strong>{{documentName}}</strong>. A copy has been saved to your file.</p>`,
  },
  ONBOARDING: {
    description: "General onboarding email with optional document attachment",
    variables: ["body", "documentUrl", "documentName"],
    subject: "{{subject}}",
    body: `<div style="white-space:pre-wrap">{{body}}</div>
{{#documentUrl}}<p style="margin-top:16px"><a href="{{documentUrl}}" style="color:#4f46e5;text-decoration:underline">Download: {{documentName}}</a></p>{{/documentUrl}}`,
  },
};

export async function getEmailTemplates() {
  const templates = await db.emailTemplate.findMany({
    orderBy: { type: "asc" },
  });

  // Merge with defaults for any missing templates
  const allTypes = Object.keys(EMAIL_TEMPLATE_DEFAULTS) as EmailTemplateType[];
  return allTypes.map((type) => {
    const existing = templates.find((t) => t.type === type);
    const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
    return {
      type,
      subject: existing?.subject ?? defaults.subject,
      body: existing?.body ?? defaults.body,
      variables: defaults.variables,
      description: defaults.description,
      isCustomized: !!existing,
      id: existing?.id ?? null,
    };
  });
}

export async function upsertEmailTemplate(data: {
  type: string;
  subject: string;
  body: string;
}) {
  const template = await db.emailTemplate.upsert({
    where: { type: data.type },
    update: { subject: data.subject, body: data.body },
    create: { type: data.type, subject: data.subject, body: data.body },
  });
  revalidatePath("/settings");
  return template;
}

export async function resetEmailTemplate(type: string) {
  try {
    await db.emailTemplate.delete({ where: { type } });
  } catch {
    // Template doesn't exist in DB — already using default
  }
  revalidatePath("/settings");
}

export async function getEmailTemplate(type: EmailTemplateType) {
  const template = await db.emailTemplate.findUnique({
    where: { type },
  });
  const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
  return {
    subject: template?.subject ?? defaults.subject,
    body: template?.body ?? defaults.body,
  };
}
