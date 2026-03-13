"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = "singleton";

export async function getCompanySettings() {
  let settings = await db.companySettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!settings) {
    settings = await db.companySettings.create({
      data: { id: SINGLETON_ID },
    });
  }
  return settings;
}

export async function updateCompanySettings(data: {
  companyName?: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
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
