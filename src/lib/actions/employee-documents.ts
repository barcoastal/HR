"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/client";

export async function getEmployeeDocuments(employeeId: string) {
  const session = await requireAuth();
  const isAdmin = session.user?.role === "ADMIN";

  return db.document.findMany({
    where: {
      employeeId,
      ...(!isAdmin ? { visibility: "EVERYONE" } : {}),
    },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function addEmployeeDocument(data: {
  employeeId: string;
  name: string;
  url: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
}) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") throw new Error("Not authorized");

  const doc = await db.document.create({
    data: {
      employeeId: data.employeeId,
      name: data.name,
      url: data.url,
      category: data.category,
      visibility: data.visibility,
    },
  });

  revalidatePath(`/people/${data.employeeId}`);
  return doc;
}

export async function deleteEmployeeDocument(docId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") throw new Error("Not authorized");

  const doc = await db.document.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("Document not found");

  await db.document.delete({ where: { id: docId } });
  revalidatePath(`/people/${doc.employeeId}`);
}
