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
  signaturePlacements?: unknown;
  countersignerId?: string | null;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const placementsArray = Array.isArray(data.signaturePlacements) ? data.signaturePlacements : [];

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
      signaturePlacements: placementsArray.length > 0 ? (placementsArray as object) : undefined,
      countersignerId: data.countersignerId ?? null,
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
  // Block access once the primary signer has signed — countersigning happens in-system via /sign-queue.
  if (request.status === "SIGNED" || request.status === "VOIDED" || request.status === "AWAITING_COUNTERSIGN") return null;

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

  if (!request || request.status === "SIGNED" || request.status === "AWAITING_COUNTERSIGN" || request.status === "VOIDED" || request.expiresAt < new Date()) {
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

    const { rgb } = await import("pdf-lib");
    const signerFullName = typedName?.trim() || request.signerName || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Signer");
    const signedDate = new Date();
    const signDate = signedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const signTime = signedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    // If the request has pre-placed signature slots (from the stage-document editor or ad-hoc editor),
    // stamp each one with the signature image (for kind=signature) or the date string (for kind=signatureDate).
    // Otherwise fall back to the legacy single-position behavior.
    type StoredPlacement = {
      page: number;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
      kind: "signature" | "signatureDate";
    };
    const placements = Array.isArray(request.signaturePlacements)
      ? (request.signaturePlacements as unknown as StoredPlacement[])
      : [];

    if (placements.length > 0) {
      // Primary signer only stamps signature/signatureDate placements.
      // Countersignature placements are stamped later when the countersigner signs.
      const primaryKinds = new Set(["signature", "signatureDate"]);
      for (const p of placements) {
        if (!primaryKinds.has(p.kind)) continue;
        const pageIndex = Math.max(0, Math.min(pages.length - 1, p.page - 1));
        const target = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = target.getSize();
        const boxX = p.xPct * pageWidth;
        const boxWidth = p.widthPct * pageWidth;
        const boxHeight = p.heightPct * pageHeight;
        const boxY = pageHeight - p.yPct * pageHeight - boxHeight;

        if (p.kind === "signature") {
          const ratio = sigImage.width / sigImage.height;
          let drawW = boxWidth;
          let drawH = drawW / ratio;
          if (drawH > boxHeight) {
            drawH = boxHeight;
            drawW = drawH * ratio;
          }
          const drawX = boxX + (boxWidth - drawW) / 2;
          const drawY = boxY + (boxHeight - drawH) / 2;
          target.drawImage(sigImage, { x: drawX, y: drawY, width: drawW, height: drawH });
          // Print signer's full name directly below the signature box
          target.drawText(signerFullName, {
            x: boxX,
            y: boxY - 10,
            size: 8,
            color: rgb(0.15, 0.15, 0.2),
          });
        } else {
          const dateText = signDate;
          const fontSize = Math.min(12, boxHeight * 0.7);
          target.drawText(dateText, {
            x: boxX + 2,
            y: boxY + (boxHeight - fontSize) / 2 + 1,
            size: fontSize,
            color: rgb(0.1, 0.1, 0.15),
          });
        }
      }

      // Audit trail on the last page
      lastPage.drawText(`Digitally signed: ${signedDate.toISOString()} by ${signerFullName}`, {
        x: 72,
        y: 20,
        size: 7,
        color: rgb(0.6, 0.6, 0.6),
      });
    } else {
      // Legacy single-position path (ad-hoc signs without pre-placed fields)
      const targetPage = signaturePosition?.page !== undefined && signaturePosition.page < pages.length
        ? pages[signaturePosition.page]
        : lastPage;
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();
      const sigWidth = 180;
      const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
      const sigX = signaturePosition
        ? (signaturePosition.xPercent / 100) * pageWidth
        : 72;
      const sigY = signaturePosition
        ? pageHeight - (signaturePosition.yPercent / 100) * pageHeight - sigHeight
        : pageHeight * 0.30;

      const blockPadding = 8;
      const nameLineY = sigY - 4;
      const dateLineY = nameLineY - 14;
      const timeLineY = dateLineY - 13;
      const blockBottom = timeLineY - blockPadding;
      const blockTop = sigY + sigHeight + blockPadding;
      const blockWidth = sigWidth + blockPadding * 2 + 40;

      targetPage.drawRectangle({
        x: sigX - blockPadding,
        y: blockBottom,
        width: blockWidth,
        height: blockTop - blockBottom,
        color: rgb(0.98, 0.98, 1),
        borderColor: rgb(0.8, 0.8, 0.85),
        borderWidth: 0.5,
      });
      targetPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });
      targetPage.drawLine({
        start: { x: sigX, y: sigY - 1 },
        end: { x: sigX + sigWidth, y: sigY - 1 },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.65),
      });
      targetPage.drawText(`Name: ${signerFullName}`, { x: sigX, y: nameLineY - 12, size: 9, color: rgb(0.15, 0.15, 0.2) });
      targetPage.drawText(`Date: ${signDate}`, { x: sigX, y: dateLineY - 12, size: 9, color: rgb(0.15, 0.15, 0.2) });
      targetPage.drawText(`Time: ${signTime}`, { x: sigX, y: timeLineY - 12, size: 9, color: rgb(0.15, 0.15, 0.2) });
      targetPage.drawText(`Digitally signed: ${signedDate.toISOString()} by ${signerFullName}`, {
        x: 72, y: 20, size: 7, color: rgb(0.6, 0.6, 0.6),
      });
    }

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

    const awaitsCountersign = !!request.countersignerId;

    // Update signing request — either fully signed, or awaiting countersignature
    await db.signingRequest.update({
      where: { id: request.id },
      data: {
        status: awaitsCountersign ? "AWAITING_COUNTERSIGN" : "SIGNED",
        signedAt: new Date(),
        signedDocUrl,
      },
    });

    if (awaitsCountersign) {
      // Notify countersigner
      try {
        const { notifyCountersigner } = await import("./countersign");
        await notifyCountersigner(request.id);
      } catch (e) {
        console.error("[signing] Failed to notify countersigner:", e);
      }
      revalidatePath("/onboarding");
      revalidatePath("/documents");
      revalidatePath("/sign-queue");
      revalidatePath("/cv");
      return { success: true };
    }

    // Fully signed — finalize
    if (request.employeeTaskId) {
      await db.employeeTask.update({
        where: { id: request.employeeTaskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

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

    if (request.candidateId) {
      await db.candidate.update({
        where: { id: request.candidateId },
        data: { offerSignedDocUrl: signedDocUrl, offerSignedAt: new Date() },
      });

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
    revalidatePath("/my-documents");
    revalidatePath("/cv");
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
