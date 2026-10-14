"use server";

import { db } from "@/lib/db";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-helpers";
import type { SignaturePlacement } from "@/lib/stage-document-utils";
import {
  applyAdminTextValues,
  getTextBoxFields,
  missingAdminRequiredFields,
  resolveTextValuesForSigning,
} from "@/lib/text-box-fields";
import { readStoredPlacements, stampPrimaryPlacements } from "@/lib/signing-stamp";
import { redactBackgroundCheck } from "@/lib/document-access";

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
  employeeTaskId?: string;
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
      employeeTaskId: data.employeeTaskId || null,
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

  // When HR still has required text boxes to fill (e.g. a stage document sent
  // automatically on a stage change), hold the email: the recipient could not
  // sign yet. It goes out once HR saves those fields (saveSigningRequestTextValues).
  const awaitingHrFields = missingAdminRequiredFields(placementsArray as SignaturePlacement[]).length > 0;

  // Send signing request email
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const signingUrl = `${baseUrl}/sign/${token}`;
  if (recipientEmail && !awaitingHrFields) {
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
    message: awaitingHrFields
      ? `${data.documentName} needs HR's fields filled in before it can be signed (Documents → Fill HR fields)`
      : `Signing request sent: ${data.documentName}`,
    link: "/documents",
    emailSubject: awaitingHrFields
      ? `HR Fields Needed: ${data.documentName}`
      : `Document Requires Signature: ${data.documentName}`,
    emailBody: awaitingHrFields
      ? `<p><strong>${data.documentName}</strong> has text boxes HR must fill in before it can be signed. Open Documents &amp; Signing and choose <strong>Fill HR fields</strong>; the signing link is emailed once they are saved.</p>`
      : `<p>A document requires your signature: <strong>${data.documentName}</strong>.</p>`,
  }).catch((err) => console.error("[signing] Sign request notification error:", err));

  revalidatePath("/documents");
  // Signing requests never carry background-check data (the sign page is public).
  return { ...request, candidate: request.candidate ? redactBackgroundCheck(request.candidate, null) : null };
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
  const missing = missingAdminRequiredFields(readStoredPlacements(request.signaturePlacements));
  if (missing.length > 0) {
    return {
      success: false,
      error: `Fill in HR's fields first (${missing.map((f) => f.label).join(", ")}). The link is emailed automatically once they're saved.`,
    };
  }

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

/**
 * HR fills in (or edits) the HR / shared text boxes on a request that has not
 * been signed yet. When this completes the last required HR box on a request
 * whose email was held back, the recipient's link is emailed now.
 */
export async function saveSigningRequestTextValues(
  id: string,
  values: Record<string, string>
): Promise<{ success: boolean; error?: string; emailed?: boolean }> {
  const session = await getSession();
  const role = session?.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Not authorized" };
  }

  const request = await db.signingRequest.findUnique({
    where: { id },
    include: { employee: true, employeeTask: { select: { documentAction: true } } },
  });
  if (!request) return { success: false, error: "Signing request not found" };
  if (request.status !== "PENDING" && request.status !== "VIEWED") {
    return { success: false, error: "This document has already been signed or voided." };
  }
  if (request.expiresAt < new Date()) return { success: false, error: "This signing link has expired." };

  const placements = readStoredPlacements(request.signaturePlacements);
  if (!getTextBoxFields(placements).some((f) => f.filledBy !== "signer")) {
    return { success: false, error: "This document has no HR text boxes." };
  }
  const wasBlocked = missingAdminRequiredFields(placements).length > 0;
  const next = applyAdminTextValues(placements, values ?? {});
  const stillMissing = missingAdminRequiredFields(next);

  await db.signingRequest.update({
    where: { id },
    data: { signaturePlacements: next as object },
  });

  let emailed = false;
  if (wasBlocked && stillMissing.length === 0) {
    const recipientEmail = request.signerEmail || request.employee?.email;
    const recipientName = request.signerName || (request.employee ? request.employee.firstName : "there");
    if (recipientEmail) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      try {
        if (request.employeeTask?.documentAction === "FILL") {
          const { sendFillRequestEmail } = await import("@/lib/email");
          await sendFillRequestEmail({
            to: recipientEmail,
            firstName: recipientName,
            documentName: request.documentName,
            fillUrl: `${baseUrl}/fill/${request.token}`,
          });
        } else {
          const { sendSigningRequestEmail } = await import("@/lib/email");
          await sendSigningRequestEmail({
            to: recipientEmail,
            firstName: recipientName,
            documentName: request.documentName,
            signingUrl: `${baseUrl}/sign/${request.token}`,
          });
        }
        emailed = true;
      } catch (e) {
        console.error("[signing] Failed to send email after HR fields were completed:", e);
      }
    }
  }

  revalidatePath("/documents");
  return { success: true, emailed };
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

  // Signing requests never carry background-check data (the sign page is public).
  return { ...request, candidate: request.candidate ? redactBackgroundCheck(request.candidate, null) : null };
}

export async function submitSignature(
  token: string,
  signatureBase64: string,
  signaturePosition?: { xPercent: number; yPercent: number; page: number },
  typedName?: string,
  initialsBase64?: string,
  fieldValues?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, candidate: true, employeeTask: true },
  });

  if (!request || request.status === "SIGNED" || request.status === "AWAITING_COUNTERSIGN" || request.status === "VOIDED" || request.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired signing request" };
  }

  // Text boxes: HR-only values always come from what HR saved (the recipient
  // cannot overwrite them), and every required box must end up filled.
  const placements = readStoredPlacements(request.signaturePlacements);
  const resolvedText = resolveTextValuesForSigning(placements, fieldValues);
  if (!resolvedText.ok) {
    return { success: false, error: resolvedText.error };
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

    // Initials image — embedded once, reused for every initials box.
    let initialsImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    if (initialsBase64) {
      try {
        const initBytes = Buffer.from(initialsBase64.replace(/^data:image\/png;base64,/, ""), "base64");
        initialsImage = await pdfDoc.embedPng(initBytes);
      } catch (e) {
        console.error("[signing] Failed to embed initials image:", e);
      }
    }

    // If the request has pre-placed slots (from the stage-document editor or the
    // ad-hoc editor), stamp each one. Otherwise fall back to the legacy
    // single-position behavior.
    if (placements.length > 0) {
      stampPrimaryPlacements(pdfDoc, placements, {
        sigImage,
        initialsImage,
        signerName: signerFullName,
        signDate,
        textValues: resolvedText.values,
      });

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
        data: {
          status: "DONE",
          completedAt: new Date(),
          completedById: request.employeeTask?.documentRecipient === "EXTERNAL" ? null : request.employeeId,
        },
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

    const writtenOfferEmployeeId = request.employeeTask?.employeeId || request.employeeId;
    if (writtenOfferEmployeeId) {
      const { maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
      await maybeAdvanceWrittenOfferToOnboarding(writtenOfferEmployeeId);
    }

    revalidatePath("/onboarding");
    revalidatePath("/pre-onboarding");
    revalidatePath("/documents");
    revalidatePath("/my-documents");
    revalidatePath("/cv");
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
