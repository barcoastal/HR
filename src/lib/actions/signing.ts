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
  employeeId?: string;
  candidateId?: string;
  signerName?: string;
  signerEmail?: string;
  documentUrl: string;
  documentName: string;
  message?: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const request = await db.signingRequest.create({
    data: {
      employeeId: data.employeeId || null,
      candidateId: data.candidateId || null,
      signerName: data.signerName || null,
      signerEmail: data.signerEmail || null,
      token,
      documentUrl: data.documentUrl,
      documentName: data.documentName,
      message: data.message || null,
      expiresAt,
    },
    include: { employee: true, candidate: true },
  });

  // Determine recipient email and name
  const recipientEmail = data.signerEmail || request.employee?.email;
  const recipientName = data.signerName || (request.employee ? request.employee.firstName : "there");

  // Send signing request email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${token}`;
  if (recipientEmail) {
    try {
      const { sendSigningRequestEmail } = await import("@/lib/email");
      await sendSigningRequestEmail({
        to: recipientEmail,
        firstName: recipientName,
        documentName: data.documentName,
        signingUrl,
      });
    } catch (e) {
      console.error("[signing] Failed to send email:", e);
    }
  }

  // Send DOCUMENT_SIGN_REQUEST notification via rules engine
  const { sendNotifications } = await import("@/lib/notifications/send");
  sendNotifications({
    action: "DOCUMENT_SIGN_REQUEST",
    candidateId: data.candidateId,
    employeeId: data.employeeId,
    message: `Signing request sent: ${data.documentName}`,
    link: "/documents",
    emailSubject: `Document Requires Signature: ${data.documentName}`,
    emailBody: `<p>A document requires your signature: <strong>${data.documentName}</strong>.</p>`,
  }).catch((err) => console.error("[signing] Sign request notification error:", err));

  revalidatePath("/documents");
  return request;
}

export async function getAllSigningRequests() {
  return db.signingRequest.findMany({
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
      employeeTask: { select: { documentAction: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resendSigningRequest(id: string) {
  const request = await db.signingRequest.findUnique({
    where: { id },
    include: { employee: true, candidate: true },
  });
  if (!request || request.status === "SIGNED") return { success: false };

  const recipientEmail = request.signerEmail || request.employee?.email;
  const recipientName = request.signerName || (request.employee ? request.employee.firstName : "there");
  if (!recipientEmail) return { success: false };

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${request.token}`;
  try {
    const { sendSigningRequestEmail } = await import("@/lib/email");
    await sendSigningRequestEmail({
      to: recipientEmail,
      firstName: recipientName,
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
    include: { employee: true, candidate: true },
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
  signaturePosition?: { xPercent: number; yPercent: number; page: number },
  typedName?: string
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, candidate: true, employeeTask: true },
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

    const { rgb } = await import("pdf-lib");
    const signerFullName = typedName?.trim() || request.signerName || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Signer");
    const signedDate = new Date();
    const signDate = signedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const signTime = signedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    // DocuSign-style signature block:
    // ┌─────────────────────────────┐
    // │  [signature image]          │
    // │  ─────────────────────────  │
    // │  Name: Full Name            │
    // │  Date: March 26, 2026       │
    // │  Time: 2:30 PM              │
    // └─────────────────────────────┘

    // Signature block starts at sigY, goes upward
    const blockPadding = 8;
    const nameLineY = sigY - 4;
    const dateLineY = nameLineY - 14;
    const timeLineY = dateLineY - 13;
    const blockBottom = timeLineY - blockPadding;
    const blockTop = sigY + sigHeight + blockPadding;
    const blockWidth = sigWidth + blockPadding * 2 + 40;

    // Draw signature block background
    targetPage.drawRectangle({
      x: sigX - blockPadding,
      y: blockBottom,
      width: blockWidth,
      height: blockTop - blockBottom,
      color: rgb(0.98, 0.98, 1),
      borderColor: rgb(0.8, 0.8, 0.85),
      borderWidth: 0.5,
    });

    // Draw signature image
    targetPage.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Draw separator line under signature
    targetPage.drawLine({
      start: { x: sigX, y: sigY - 1 },
      end: { x: sigX + sigWidth, y: sigY - 1 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.65),
    });

    // Name
    targetPage.drawText(`Name: ${signerFullName}`, {
      x: sigX,
      y: nameLineY - 12,
      size: 9,
      color: rgb(0.15, 0.15, 0.2),
    });

    // Date
    targetPage.drawText(`Date: ${signDate}`, {
      x: sigX,
      y: dateLineY - 12,
      size: 9,
      color: rgb(0.15, 0.15, 0.2),
    });

    // Time
    targetPage.drawText(`Time: ${signTime}`, {
      x: sigX,
      y: timeLineY - 12,
      size: 9,
      color: rgb(0.15, 0.15, 0.2),
    });

    // Small audit trail at the very bottom of the page
    targetPage.drawText(`Digitally signed: ${signedDate.toISOString()} by ${signerFullName}`, {
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

    // Store in employee documents (only if linked to an employee)
    if (request.employeeId) {
      await db.document.create({
        data: {
          employeeId: request.employeeId,
          name: `Signed: ${request.documentName}`,
          url: signedDocUrl,
          category: "ONBOARDING",
        },
      });
    }

    // If this is a candidate signing (offer letter), update the candidate record
    if (request.candidateId) {
      await db.candidate.update({
        where: { id: request.candidateId },
        data: { offerSignedDocUrl: signedDocUrl, offerSignedAt: new Date() },
      });

      // Notify via centralized rules engine
      const { sendNotifications } = await import("@/lib/notifications/send");
      const candidate = request.candidate;
      if (candidate) {
        sendNotifications({
          action: "DOCUMENT_SIGNED",
          candidateId: request.candidateId!,
          message: `${candidate.firstName} ${candidate.lastName} signed ${request.documentName}`,
          link: "/cv",
          emailSubject: `Document Signed: ${request.documentName}`,
          emailBody: `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> has signed <strong>${request.documentName}</strong>.</p>`,
        }).catch((err) => console.error("[signing] Notification error:", err));
      }
    }

    revalidatePath("/onboarding");
    revalidatePath("/documents");
    revalidatePath("/cv");
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
