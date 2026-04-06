import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PDFDocument, rgb } from "pdf-lib";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Minimal check — just verify the token is valid and return doc info
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request || request.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired request" }, { status: 404 });
  }
  if (request.status === "SIGNED" || request.status === "VOIDED") {
    return NextResponse.json({ error: "Already completed" }, { status: 404 });
  }

  // Mark as viewed
  if (request.status === "PENDING") {
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  const employeeName = request.signerName
    || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Employee");

  return NextResponse.json({
    documentName: request.documentName,
    employeeName,
    status: request.status,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { pageImages, signatureBase64, sigPosition } = body;

  const signingRequest = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!signingRequest || signingRequest.status === "SIGNED" || signingRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired request" }, { status: 400 });
  }

  if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
    return NextResponse.json({ error: "No page data" }, { status: 400 });
  }

  try {
    const pdfDoc = await PDFDocument.create();

    for (const imgData of pageImages) {
      const imgBytes = Buffer.from(imgData.replace(/^data:image\/png;base64,/, ""), "base64");
      const img = await pdfDoc.embedPng(imgBytes);
      const pageWidth = 612;
      const pageHeight = (img.height / img.width) * pageWidth;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }

    // Add signature block at user-chosen position
    if (signatureBase64 && sigPosition) {
      const signerName = signingRequest.signerName
        || (signingRequest.employee ? `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}` : "Employee");
      const signDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const sigBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const pages = pdfDoc.getPages();
      const pageIdx = Math.min(sigPosition.page || 0, pages.length - 1);
      const page = pages[pageIdx];
      const { width: pw, height: ph } = page.getSize();
      const sigWidth = Math.min(150, pw * 0.22);
      const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

      const x = (sigPosition.xPercent / 100) * pw;
      const y = ph - (sigPosition.yPercent / 100) * ph - sigHeight;

      page.drawImage(sigImage, { x, y, width: sigWidth, height: sigHeight });
      page.drawLine({
        start: { x, y: y - 2 },
        end: { x: x + sigWidth, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(signerName, {
        x, y: y - 14, size: 9,
        color: rgb(0.1, 0.1, 0.15),
      });
      page.drawText(signDate, {
        x, y: y - 25, size: 8,
        color: rgb(0.35, 0.35, 0.4),
      });
    }

    const pdfBytes = await pdfDoc.save();

    // Store filled PDF
    const filename = `${randomUUID()}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    await db.fileBlob.create({
      data: { filename, mimeType: "application/pdf", size: buffer.length, data: buffer },
    });
    const filledDocUrl = `/api/onboarding-docs/${filename}`;

    // Update signing request
    await db.signingRequest.update({
      where: { id: signingRequest.id },
      data: { status: "SIGNED", signedAt: new Date(), signedDocUrl: filledDocUrl },
    });

    // Complete employee task
    if (signingRequest.employeeTaskId) {
      await db.employeeTask.update({
        where: { id: signingRequest.employeeTaskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

    // Store in employee documents
    if (signingRequest.employeeId) {
      await db.document.create({
        data: {
          employeeId: signingRequest.employeeId,
          name: `Filled: ${signingRequest.documentName}`,
          url: filledDocUrl,
          category: "ONBOARDING",
        },
      });
    }

    // Confirmation email
    const email = signingRequest.signerEmail || signingRequest.employee?.email;
    const name = signingRequest.signerName || signingRequest.employee?.firstName || "there";
    if (email) {
      try {
        const { sendFillConfirmationEmail } = await import("@/lib/email");
        await sendFillConfirmationEmail({ to: email, firstName: name, documentName: signingRequest.documentName });
      } catch (e) {
        console.error("[fill] Confirmation email failed:", e);
      }
    }

    revalidatePath("/onboarding");
    revalidatePath("/documents");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fill] Submit error:", error);
    return NextResponse.json({ success: false, error: "Failed to process" }, { status: 500 });
  }
}
