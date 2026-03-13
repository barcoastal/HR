"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-defaults";
import type { EmailTemplateType } from "@/lib/email-template-defaults";

export async function getEmailTemplates() {
  const templates = await db.emailTemplate.findMany({
    orderBy: { type: "asc" },
  });

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
    // Already using default
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
