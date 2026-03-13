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
      senderEmail: "onboarding@resend.dev",
      senderName: "Coastal HR",
      updatedAt: new Date(),
    };
  }
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
