"use server";

import { db } from "@/lib/db";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";

export async function createSigningRequest(
  employeeTaskId: string,
  employeeId: string,
  documentUrl: string,
  documentName: string
) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return db.signingRequest.create({
    data: {
      employeeTaskId,
      employeeId,
      token,
      documentUrl,
      documentName,
      expiresAt,
    },
  });
}

export async function createStandaloneSigningRequest(data: {
  employeeId: string;
  documentUrl: string;
  documentName: string;
  message?: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const request = await db.signingRequest.create({
    data: {
      employeeId: data.employeeId,
      token,
      documentUrl: data.documentUrl,
      documentName: data.documentName,
      message: data.message || null,
      expiresAt,
    },
    include: { employee: true },
  });

  // Send signing request email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${token}`;
  try {
    const { sendSigningRequestEmail } = await import("@/lib/email");
    await sendSigningRequestEmail({
      to: request.employee.email,
      firstName: request.employee.firstName,
      documentName: data.documentName,
      signingUrl,
    });
  } catch (e) {
    console.error("[signing] Failed to send email:", e);
  }

  revalidatePath("/documents");
  return request;
}

export async function getAllSigningRequests() {
  return db.signingRequest.findMany({
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resendSigningRequest(id: string) {
  const request = await db.signingRequest.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!request || request.status === "SIGNED") return { success: false };

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${request.token}`;
  try {
    const { sendSigningRequestEmail } = await import("@/lib/email");
    await sendSigningRequestEmail({
      to: request.employee.email,
      firstName: request.employee.firstName,
      documentName: request.documentName,
      signingUrl,
    });
  } catch (e) {
    console.error("[signing] Failed to resend email:", e);
  }
  return { success: true };
}

export async function voidSigningRequest(id: string) {
  await db.signingRequest.update({
    where: { id },
    data: { status: "VOIDED", expiresAt: new Date() },
  });
  revalidatePath("/documents");
}

export async function getSigningRequestByToken(token: string) {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request) return null;
  if (request.expiresAt < new Date()) return null;
  if (request.status === "SIGNED" || request.status === "VOIDED") return null;

  // Mark as viewed
  if (request.status === "PENDING") {
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  return request;
}

export async function submitSignature(
  token: string,
  signatureBase64: string,
  signaturePosition?: { xPercent: number; yPercent: number; page: number }
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!request || request.status === "SIGNED" || request.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired signing request" };
  }

  try {
    // Fetch original PDF from database
    const docFilename = request.documentUrl.split("/").pop();
    if (!docFilename) {
      return { success: false, error: "Invalid document URL" };
    }
    const fileBlob = await db.fileBlob.findUnique({
      where: { filename: docFilename },
      select: { data: true },
    });
    if (!fileBlob) {
      return { success: false, error: "Could not fetch document" };
    }
    const pdfBytes = fileBlob.data;

    // Load PDF and add signature
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    // Decode signature image
    const sigImageBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    // Determine which page and position to place signature
    const targetPage = signaturePosition?.page !== undefined && signaturePosition.page < pages.length
      ? pages[signaturePosition.page]
      : lastPage;
    const { width: pageWidth, height: pageHeight } = targetPage.getSize();

    const sigWidth = 180;
    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

    // If position provided from client, use percentage-based coordinates
    // Otherwise default to a sensible position (where signature lines typically are)
    const sigX = signaturePosition
      ? (signaturePosition.xPercent / 100) * pageWidth
      : 72; // ~1 inch from left
    const sigY = signaturePosition
      ? pageHeight - (signaturePosition.yPercent / 100) * pageHeight - sigHeight
      : pageHeight * 0.30; // ~30% from bottom — where most signature lines are

    targetPage.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Add printed name below signature
    const { rgb } = await import("pdf-lib");
    const employeeName = `${request.employee.firstName} ${request.employee.lastName}`;
    targetPage.drawText(employeeName, {
      x: sigX,
      y: sigY - 14,
      size: 10,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Add date to the right of the signature
    const signDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    targetPage.drawText(signDate, {
      x: sigX + sigWidth + 40,
      y: sigY + sigHeight / 2,
      size: 10,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Add small timestamp at the very bottom
    targetPage.drawText(`Digitally signed: ${new Date().toISOString()} by ${employeeName}`, {
      x: 72,
      y: 20,
      size: 7,
      color: rgb(0.6, 0.6, 0.6),
    });

    const signedPdfBytes = await pdfDoc.save();

    // Store signed PDF directly in database
    const signedFilename = `${randomUUID()}.pdf`;
    const signedBuffer = Buffer.from(signedPdfBytes);
    await db.fileBlob.create({
      data: {
        filename: signedFilename,
        mimeType: "application/pdf",
        size: signedBuffer.length,
        data: signedBuffer,
      },
    });
    const signedDocUrl = `/api/onboarding-docs/${signedFilename}`;

    // Update signing request
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "SIGNED", signedAt: new Date(), signedDocUrl },
    });

    // Auto-complete the employee task (if linked to one)
    if (request.employeeTaskId) {
      await db.employeeTask.update({
        where: { id: request.employeeTaskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

    // Store in employee documents
    await db.document.create({
      data: {
        employeeId: request.employeeId,
        name: `Signed: ${request.documentName}`,
        url: signedDocUrl,
        category: "ONBOARDING",
      },
    });

    revalidatePath("/onboarding");
    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
