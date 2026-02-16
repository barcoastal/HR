"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function submitAnonFeedback(content: string) {
  const feedback = await db.anonFeedback.create({
    data: { content },
  });
  revalidatePath("/voice");
  return feedback;
}

export async function getAnonFeedback() {
  return db.anonFeedback.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function replyToAnonFeedback(id: string, adminReply: string) {
  const feedback = await db.anonFeedback.update({
    where: { id },
    data: { adminReply },
  });
  revalidatePath("/voice");
  return feedback;
}
