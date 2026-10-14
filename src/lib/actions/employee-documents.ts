"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/client";
import { sendSigningRequestEmail } from "@/lib/email";
import crypto from "crypto";
import {
  resolveDocumentVisibility,
  type DocumentFolderKey,
  type DocumentVisibilityKey,
} from "@/lib/document-folders";
import {
  isSuperAdmin,
  isSuperAdminOnlyCategory,
  isSuperAdminOnlyDocument,
  visibleDocumentsWhere,
} from "@/lib/document-access";

export async function getEmployeeDocuments(employeeId: string) {
  const session = await requireAuth();

  return db.document.findMany({
    where: {
      employeeId,
      // HR_ONLY is hidden from managers/employees; I-9s and background checks
      // from everyone but Super Admins.
      ...visibleDocumentsWhere(session.user?.role),
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
  const restricted = isSuperAdminOnlyCategory(data.category);
  if (restricted && !isSuperAdmin(session.user?.role)) {
    throw new Error("Only Super Admins can file I-9s and background checks.");
  }

  const doc = await db.document.create({
    data: {
      employeeId: data.employeeId,
      name: data.name,
      url: data.url,
      category: data.category,
      visibility: resolveDocumentVisibility(data.category, data.visibility),
    },
  });

  if (restricted) {
    // Never sent for signing/filling: that would put the file in the
    // employee's tasks and inbox.
    const { audit } = await import("@/lib/audit");
    await audit({
      action: data.category === "I9" ? "i9.uploaded" : "background_check_document.uploaded",
      entityType: "document",
      entityId: doc.id,
      details: { employeeId: data.employeeId, name: data.name },
    });
    revalidatePath(`/people/${data.employeeId}`);
    revalidatePath("/compliance");
    return doc;
  }

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
  await assertNotRestrictedDocumentUrl(documentUrl);

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
  await assertNotRestrictedDocumentUrl(documentUrl);

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

export async function updateEmployeeDocument(
  docId: string,
  changes: { category?: DocumentFolderKey; visibility?: DocumentVisibilityKey }
) {
  const session = await requireAuth();
  const { updateDocumentSettings } = await import("@/lib/employee-document-update");
  const result = await updateDocumentSettings(docId, changes, session.user);
  if (!result.ok) return result;

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "document.settings_changed",
    entityType: "document",
    entityId: docId,
    details: { employeeId: result.employeeId, name: result.name, ...changes },
  });
  revalidatePath(`/people/${result.employeeId}`);
  return { ok: true as const };
}

export async function makeAllEmployeeDocumentsHrOnly(employeeId: string) {
  const session = await requireAuth();
  const { restrictAllDocumentsToHr } = await import("@/lib/employee-document-update");
  const result = await restrictAllDocumentsToHr(employeeId, session.user);
  if (!result.ok) return result;

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "document.all_restricted_to_hr",
    entityType: "employee",
    entityId: employeeId,
    details: { documentsChanged: result.changed },
  });
  revalidatePath(`/people/${employeeId}`);
  return result;
}

export async function deleteEmployeeDocument(docId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") throw new Error("Not authorized");

  const doc = await db.document.findUnique({ where: { id: docId } });
  const restricted = doc ? isSuperAdminOnlyDocument(doc) : false;
  if (!doc || (restricted && !isSuperAdmin(session.user?.role))) throw new Error("Document not found");

  await db.document.delete({ where: { id: docId } });
  if (restricted) {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: doc.category === "I9" ? "i9.deleted" : "background_check_document.deleted",
      entityType: "document",
      entityId: docId,
      details: { employeeId: doc.employeeId, name: doc.name },
    });
    revalidatePath("/compliance");
  }
  revalidatePath(`/people/${doc.employeeId}`);
}

/**
 * I-9s and background checks are never sent out for signing or filling — the
 * request would surface the file in the employee's tasks and email.
 */
async function assertNotRestrictedDocumentUrl(documentUrl: string) {
  const restricted = await db.document.findFirst({
    where: { url: documentUrl, OR: [{ visibility: "SUPER_ADMIN_ONLY" }, { category: { in: ["I9", "BACKGROUND_CHECK"] } }] },
    select: { id: true },
  });
  if (restricted) throw new Error("I-9s and background checks can't be sent for signing.");
}

/**
 * Pull a candidate resume onto this employee's Documents (HR-only). Without a
 * candidateId the match is automatic (email, then an unambiguous name); when it
 * can't decide, `candidates` lists the records HR can choose from.
 */
export async function pullCandidateResumeToEmployee(employeeId: string, candidateId?: string) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") {
    return { success: false as const, error: "Not authorized" };
  }
  const { attachResumeFromMatchingCandidate } = await import("@/lib/hire-resume");
  const result = await attachResumeFromMatchingCandidate(employeeId, candidateId);
  if (result.attached) {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "document.resume_pulled_from_candidate",
      entityType: "employee",
      entityId: employeeId,
      details: candidateId ? { candidateId, pickedByHr: true } : {},
    });
    revalidatePath(`/people/${employeeId}`);
    return { success: true as const };
  }
  return { success: false as const, error: result.reason || "Could not attach resume", candidates: result.candidates };
}

/** Candidates HR can pick a resume from: name matches by default, or a name/email search. */
export async function searchResumeCandidates(employeeId: string, query: string) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN" && session.user?.role !== "ADMIN" && session.user?.role !== "HR") {
    return [];
  }
  const { listResumeCandidates } = await import("@/lib/hire-resume");
  return listResumeCandidates(employeeId, query);
}
