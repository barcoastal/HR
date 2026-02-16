"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getJobTitles() {
  return db.jobTitle.findMany({ orderBy: { name: "asc" } });
}

export async function createJobTitle(name: string) {
  const jobTitle = await db.jobTitle.create({ data: { name } });
  revalidatePath("/settings");
  return jobTitle;
}

export async function deleteJobTitle(id: string) {
  await db.jobTitle.delete({ where: { id } });
  revalidatePath("/settings");
}
