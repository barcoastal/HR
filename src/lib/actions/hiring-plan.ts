"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = "singleton";

export type HiringSlot = {
  id: string;
  label: string;
  employeeId?: string | null;
};

export type HiringBox = {
  id: string;
  title: string;
  color: string; // tailwind color name we map to a palette in the UI
  slots: HiringSlot[];
};

export type HiringPlanData = {
  boxes: HiringBox[];
};

const DEFAULT_PLAN: HiringPlanData = { boxes: [] };

async function gate() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getHiringPlan(): Promise<HiringPlanData> {
  await gate();
  const row = await db.hiringPlan.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return DEFAULT_PLAN;
  try {
    return row.data as unknown as HiringPlanData;
  } catch {
    return DEFAULT_PLAN;
  }
}

export async function saveHiringPlan(data: HiringPlanData) {
  await gate();
  await db.hiringPlan.upsert({
    where: { id: SINGLETON_ID },
    update: { data: data as unknown as object },
    create: { id: SINGLETON_ID, data: data as unknown as object },
  });
  revalidatePath("/hiring-plan");
  return { success: true };
}
