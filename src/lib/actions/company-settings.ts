"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = "singleton";

export async function getCompanySettings() {
  try {
    return await db.companySettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  } catch {
    // DB unreachable during build — return defaults
    return {
      id: SINGLETON_ID,
      companyName: "Coastal HR",
      domain: "",
      industry: "",
      companySize: "",
      logoUrl: null,
      faviconUrl: null,
      senderEmail: "noreply@hr.coastaldebt-tools.com",
      senderName: "Coastal HR",
      recruiterIds: "[]",
      updatedAt: new Date(),
    };
  }
}

export async function getRecruiters() {
  const settings = await getCompanySettings();
  const ids: string[] = JSON.parse(settings.recruiterIds || "[]");
  if (ids.length === 0) return [];
  return db.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
  });
}

export async function updateRecruiters(recruiterIds: string[]) {
  await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: { recruiterIds: JSON.stringify(recruiterIds) },
    create: { id: SINGLETON_ID, recruiterIds: JSON.stringify(recruiterIds) },
  });
  revalidatePath("/settings");
  revalidatePath("/cv");
}

export async function updateCompanySettings(data: {
  companyName?: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  senderEmail?: string;
  senderName?: string;
  recruiterIds?: string;
}) {
  const settings = await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return settings;
}
