"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";

type StoredPlacement = {
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  kind: "signature" | "signatureDate" | "countersignature" | "countersignatureDate";
};

export async function notifyCountersigner(requestId: string) {
  const request = await db.signingRequest.findUnique({
    where: { id: requestId },
    include: {
      countersigner: { select: { email: true, firstName: true } },
      employee: { select: { firstName: true, lastName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  });
  if (!request || !request.countersigner?.email) return;

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const queueUrl = `${baseUrl}/sign-queue/${request.id}`;
  const signerName = request.employee
    ? `${request.employee.firstName} ${request.employee.lastName}`
    : request.candidate
    ? `${request.candidate.firstName} ${request.candidate.lastName}`
    : (request.signerName || "The recipient");

  try {
    const { sendCountersignRequestEmail } = await import("@/lib/email");
    await sendCountersignRequestEmail({
      to: request.countersigner.email,
      firstName: request.countersigner.firstName,
      documentName: request.documentName,
      signerName,
      countersignUrl: queueUrl,
    });
  } catch (e) {
    console.error("[countersign] Failed to send email:", e);
  }
}

export async function getMyCountersignQueue() {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) return [];
  return db.signingRequest.findMany({
    where: { countersignerId: employeeId, status: "AWAITING_COUNTERSIGN" },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true } },
      candidate: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { signedAt: "desc" },
  });
}

export async function getCountersignRequestForMe(id: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) return null;
  const request = await db.signingRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true } },
      candidate: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!request) return null;
  if (request.countersignerId !== employeeId) return null;
  if (request.status !== "AWAITING_COUNTERSIGN") return null;
  return request;
}

export async function submitCountersignature(
  requestId: string,
  signatureBase64: string,
  typedName?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { success: false, error: "No employee linked to your account" };

  const request = await db.signingRequest.findUnique({
    where: { id: requestId },
    include: { employee: true, candidate: true, employeeTask: true, countersigner: true },
  });
  if (!request) return { success: false, error: "Request not found" };
  if (request.countersignerId !== employeeId) return { success: false, error: "You are not the countersigner" };
  if (request.status !== "AWAITING_COUNTERSIGN") return { success: false, error: "Request is not awaiting countersignature" };
  if (!request.signedDocUrl) return { success: false, error: "Primary signature missing" };

  try {
    // Load the already-signed PDF
    const docFilename = request.signedDocUrl.split("/").pop();
    if (!docFilename) return { success: false, error: "Invalid document URL" };
    const fileBlob = await db.fileBlob.findUnique({ where: { filename: docFilename }, select: { data: true } });
    if (!fileBlob) return { success: false, error: "Could not fetch document" };

    const pdfDoc = await PDFDocument.load(fileBlob.data);
    const pages = pdfDoc.getPages();

    const sigImageBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    const { rgb } = await import("pdf-lib");
    const countersignerFullName = typedName?.trim()
      || (request.countersigner ? `${request.countersigner.firstName} ${request.countersigner.lastName}` : "Countersigner");
    const signedDate = new Date();
    const signDate = signedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const placements = Array.isArray(request.signaturePlacements)
      ? (request.signaturePlacements as unknown as StoredPlacement[])
      : [];
    const countersignKinds = new Set(["countersignature", "countersignatureDate"]);
    const hasCountersignSlot = placements.some((p) => p.kind === "countersignature");

    // Fallback for ad-hoc sends without pre-placed countersignature boxes: stamp a
    // default block on the bottom-right of the last page.
    if (!hasCountersignSlot) {
      const last = pages[pages.length - 1];
      const { width: pw, height: ph } = last.getSize();
      const bw = 180;
      const bh = (sigImage.height / sigImage.width) * bw;
      const bx = pw - bw - 72;
      const by = 80;
      last.drawImage(sigImage, { x: bx, y: by, width: bw, height: bh });
      last.drawLine({ start: { x: bx, y: by - 2 }, end: { x: bx + bw, y: by - 2 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.65) });
      last.drawText(`Countersigned by: ${countersignerFullName}`, { x: bx, y: by - 14, size: 9, color: rgb(0.15, 0.15, 0.2) });
      const jobTitle = request.countersigner?.jobTitle;
      if (jobTitle) {
        last.drawText(jobTitle, { x: bx, y: by - 26, size: 8, color: rgb(0.45, 0.45, 0.5) });
        last.drawText(`Date: ${signDate}`, { x: bx, y: by - 38, size: 9, color: rgb(0.15, 0.15, 0.2) });
      } else {
        last.drawText(`Date: ${signDate}`, { x: bx, y: by - 26, size: 9, color: rgb(0.15, 0.15, 0.2) });
      }
    }

    for (const p of placements) {
      if (!countersignKinds.has(p.kind)) continue;
      const pageIndex = Math.max(0, Math.min(pages.length - 1, p.page - 1));
      const target = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = target.getSize();
      const boxX = p.xPct * pageWidth;
      const boxWidth = p.widthPct * pageWidth;
      const boxHeight = p.heightPct * pageHeight;
      const boxY = pageHeight - p.yPct * pageHeight - boxHeight;

      if (p.kind === "countersignature") {
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
        // Draw name + title directly below the signature box
        const titleText = request.countersigner?.jobTitle || "";
        target.drawText(countersignerFullName, {
          x: boxX,
          y: boxY - 10,
          size: 8,
          color: rgb(0.15, 0.15, 0.2),
        });
        if (titleText) {
          target.drawText(titleText, {
            x: boxX,
            y: boxY - 19,
            size: 7,
            color: rgb(0.45, 0.45, 0.5),
          });
        }
      } else {
        const fontSize = Math.min(12, boxHeight * 0.7);
        target.drawText(signDate, {
          x: boxX + 2,
          y: boxY + (boxHeight - fontSize) / 2 + 1,
          size: fontSize,
          color: rgb(0.1, 0.1, 0.15),
        });
      }
    }

    const lastPage = pages[pages.length - 1];
    lastPage.drawText(`Countersigned: ${signedDate.toISOString()} by ${countersignerFullName}`, {
      x: 72, y: 10, size: 7, color: rgb(0.6, 0.6, 0.6),
    });

    const finalBytes = await pdfDoc.save();
    const finalFilename = `${randomUUID()}.pdf`;
    const finalBuffer = Buffer.from(finalBytes);
    await db.fileBlob.create({
      data: { filename: finalFilename, mimeType: "application/pdf", size: finalBuffer.length, data: finalBuffer },
    });
    const finalUrl = `/api/onboarding-docs/${finalFilename}`;

    await db.signingRequest.update({
      where: { id: request.id },
      data: {
        status: "SIGNED",
        countersignerSignedAt: signedDate,
        signedDocUrl: finalUrl,
      },
    });

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
          url: finalUrl,
          category: "ONBOARDING",
        },
      });
    }

    if (request.candidateId) {
      await db.candidate.update({
        where: { id: request.candidateId },
        data: { offerSignedDocUrl: finalUrl, offerSignedAt: signedDate },
      });
    }

    // Notify original signer that the doc is fully executed
    try {
      const recipientEmail = request.signerEmail || request.employee?.email || request.candidate?.email;
      const recipientName = request.employee?.firstName || request.candidate?.firstName || request.signerName || "there";
      if (recipientEmail) {
        const { sendCountersignCompletedEmail } = await import("@/lib/email");
        await sendCountersignCompletedEmail({
          to: recipientEmail,
          firstName: recipientName,
          documentName: request.documentName,
        });
      }
    } catch (e) {
      console.error("[countersign] Failed to send completion email:", e);
    }

    revalidatePath("/sign-queue");
    revalidatePath("/documents");
    revalidatePath("/my-documents");
    revalidatePath("/onboarding");
    revalidatePath("/cv");
    return { success: true };
  } catch (error) {
    console.error("Countersign error:", error);
    return { success: false, error: "Failed to process countersignature" };
  }
}
