"use server";

import { db } from "@/lib/db";
import crypto from "crypto";
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

export async function getSigningRequestByToken(token: string) {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request) return null;
  if (request.expiresAt < new Date()) return null;
  if (request.status === "SIGNED") return null;

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
  signatureBase64: string
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!request || request.status === "SIGNED" || request.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired signing request" };
  }

  try {
    // Fetch original PDF
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const pdfResponse = await fetch(`${baseUrl}${request.documentUrl}`);
    if (!pdfResponse.ok) {
      return { success: false, error: "Could not fetch document" };
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Load PDF and add signature
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    // Decode signature image
    const sigImageBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    // Draw signature on last page (bottom area)
    const sigWidth = 200;
    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
    lastPage.drawImage(sigImage, {
      x: 50,
      y: 50,
      width: sigWidth,
      height: sigHeight,
    });

    // Add timestamp text
    const { rgb } = await import("pdf-lib");
    lastPage.drawText(`Signed: ${new Date().toISOString()} by ${request.employee.firstName} ${request.employee.lastName}`, {
      x: 50,
      y: 40,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    });

    const signedPdfBytes = await pdfDoc.save();

    // Store signed PDF via upload
    const formData = new FormData();
    const signedBlob = new Blob([signedPdfBytes as BlobPart], { type: "application/pdf" });
    formData.append("file", signedBlob, `signed-${request.documentName}`);

    const uploadResponse = await fetch(`${baseUrl}/api/onboarding-docs/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      return { success: false, error: "Failed to store signed document" };
    }

    const { url: signedDocUrl } = await uploadResponse.json();

    // Update signing request
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "SIGNED", signedAt: new Date(), signedDocUrl },
    });

    // Auto-complete the employee task
    await db.employeeTask.update({
      where: { id: request.employeeTaskId },
      data: { status: "DONE", completedAt: new Date() },
    });

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
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
