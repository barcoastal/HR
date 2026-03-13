"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function getHRNotes(employeeId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") return [];

  return db.hRNote.findMany({
    where: { employeeId },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function addHRNote(employeeId: string, content: string) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") throw new Error("Not authorized");
  if (!content.trim()) throw new Error("Note content required");

  const authorId = session.user.employeeId;
  if (!authorId) throw new Error("No employee profile linked to admin account");

  const note = await db.hRNote.create({
    data: { employeeId, authorId, content: content.trim() },
  });

  revalidatePath(`/people/${employeeId}`);
  return note;
}

export async function deleteHRNote(noteId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") throw new Error("Not authorized");

  const note = await db.hRNote.findUnique({ where: { id: noteId } });
  if (!note) throw new Error("Note not found");

  await db.hRNote.delete({ where: { id: noteId } });
  revalidatePath(`/people/${note.employeeId}`);
}
