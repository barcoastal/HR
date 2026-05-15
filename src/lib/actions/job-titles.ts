"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

async function assertCanManageJobTitles() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to manage job titles");
  }
}

export async function getJobTitles() {
  await requireAuth();
  return db.jobTitle.findMany({ orderBy: { name: "asc" } });
}

export async function createJobTitle(name: string) {
  await assertCanManageJobTitles();
  const jobTitle = await db.jobTitle.create({ data: { name } });
  revalidatePath("/settings");
  return jobTitle;
}

export async function deleteJobTitle(id: string) {
  await assertCanManageJobTitles();
  await db.jobTitle.delete({ where: { id } });
  revalidatePath("/settings");
}
