"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/client";
import { sendSigningRequestEmail } from "@/lib/email";
import crypto from "crypto";

export async function getEmployeeDocuments(employeeId: string) {
  const session = await requireAuth();
  const isAdmin = session.user?.role === "SUPER_ADMIN" || session.user?.role === "ADMIN" || session.user?.role === "HR";

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
  requireSignature?: boolean;
  requireFill?: boolean;
}) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") throw new Error("Not authorized");

  const doc = await db.document.create({
    data: {
      employeeId: data.employeeId,
      name: data.name,
      url: data.url,
      category: data.category,
      visibility: data.visibility,
    },
  });

  if (data.requireFill) {
    await sendDocForFilling(data.employeeId, data.url, data.name);
  } else if (data.requireSignature) {
    await sendDocForSigning(data.employeeId, data.url, data.name);
  }

  revalidatePath(`/people/${data.employeeId}`);
  return doc;
}

export async function sendDocForSigning(employeeId: string, documentUrl: string, documentName: string) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") throw new Error("Not authorized");

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  // Create an employee task for this signing
  const employeeTask = await db.employeeTask.create({
    data: {
      employeeId,
      title: `Sign: ${documentName}`,
      description: `Please review and sign ${documentName}`,
      documentAction: "SIGN",
      documentUrl,
      documentName,
      status: "PENDING",
    },
  });

  // Create signing request
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.signingRequest.create({
    data: {
      employeeTaskId: employeeTask.id,
      employeeId,
      token,
      documentUrl,
      documentName,
      expiresAt,
    },
  });

  // Send signing email
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendSigningRequestEmail({
    to: employee.email,
    firstName: employee.firstName,
    documentName,
    signingUrl: `${baseUrl}/sign/${token}`,
  });
  console.log(`[signing] Sent signing request to ${employee.email} for "${documentName}" — link: ${baseUrl}/sign/${token}`);

  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function sendDocForFilling(
  employeeId: string,
  documentUrl: string,
  documentName: string,
  countersignerId?: string | null,
  signaturePlacements?: unknown,
) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") throw new Error("Not authorized");

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const employeeTask = await db.employeeTask.create({
    data: {
      employeeId,
      title: `Fill: ${documentName}`,
      description: `Please fill out ${documentName}`,
      documentAction: "FILL",
      documentUrl,
      documentName,
      status: "PENDING",
    },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const placementsArray = Array.isArray(signaturePlacements) ? signaturePlacements : [];
  await db.signingRequest.create({
    data: {
      employeeTaskId: employeeTask.id,
      employeeId,
      token,
      documentUrl,
      documentName,
      expiresAt,
      countersignerId: countersignerId || null,
      signaturePlacements: placementsArray.length > 0 ? (placementsArray as object) : undefined,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { sendFillRequestEmail } = await import("@/lib/email");
  await sendFillRequestEmail({
    to: employee.email,
    firstName: employee.firstName,
    documentName,
    fillUrl: `${baseUrl}/fill/${token}`,
  });
  console.log(`[filling] Sent fill request to ${employee.email} for "${documentName}" — link: ${baseUrl}/fill/${token}`);

  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function deleteEmployeeDocument(docId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") throw new Error("Not authorized");

  const doc = await db.document.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("Document not found");

  await db.document.delete({ where: { id: docId } });
  revalidatePath(`/people/${doc.employeeId}`);
}
