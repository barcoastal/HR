import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PDFDocument } from "pdf-lib";
import { readStoredPlacements, stampFillSignature } from "@/lib/signing-stamp";
import { resolveTextValuesForSigning } from "@/lib/text-box-fields";
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
  if (request.status === "SIGNED" || request.status === "AWAITING_COUNTERSIGN" || request.status === "VOIDED") {
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
  const { pageImages, signatureBase64, sigPosition, fieldValues } = body;

  const signingRequest = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!signingRequest || signingRequest.status === "SIGNED" || signingRequest.status === "AWAITING_COUNTERSIGN" || signingRequest.status === "VOIDED" || signingRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired request" }, { status: 400 });
  }

  if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
    return NextResponse.json({ error: "No page data" }, { status: 400 });
  }

  // HR-only text values come from what HR saved; required boxes must be filled.
  const placements = readStoredPlacements(signingRequest.signaturePlacements);
  const resolvedText = resolveTextValuesForSigning(placements, fieldValues);
  if (!resolvedText.ok) {
    return NextResponse.json({ success: false, error: resolvedText.error }, { status: 400 });
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

    // Signature goes in HR's placed boxes when there are any, otherwise at the
    // recipient's chosen spot; text boxes and dates are stamped too.
    await stampFillSignature(pdfDoc, placements, {
      signatureBase64,
      sigPosition,
      signerName: signingRequest.signerName
        || (signingRequest.employee ? `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}` : "Employee"),
      textValues: resolvedText.values,
    });

    const pdfBytes = await pdfDoc.save();

    // Store filled PDF
    const filename = `${randomUUID()}.pdf`;
    const buffer = Buffer.from(pdfBytes);
    await db.fileBlob.create({
      data: { filename, mimeType: "application/pdf", size: buffer.length, data: buffer },
    });
    const filledDocUrl = `/api/onboarding-docs/${filename}`;

    const awaitsCountersign = !!signingRequest.countersignerId;

    // A countersigned form remains incomplete until the internal signer acts.
    await db.signingRequest.update({
      where: { id: signingRequest.id },
      data: {
        status: awaitsCountersign ? "AWAITING_COUNTERSIGN" : "SIGNED",
        signedAt: new Date(),
        signedDocUrl: filledDocUrl,
      },
    });

    if (awaitsCountersign) {
      const { notifyCountersigner } = await import("@/lib/actions/countersign");
      await notifyCountersigner(signingRequest.id);
      revalidatePath("/sign-queue");
      revalidatePath("/documents");
      return NextResponse.json({ success: true });
    }

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

    const writtenOfferEmployeeId = signingRequest.employeeTask?.employeeId || signingRequest.employeeId;
    if (writtenOfferEmployeeId) {
      const { maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
      await maybeAdvanceWrittenOfferToOnboarding(writtenOfferEmployeeId);
    }

    revalidatePath("/onboarding");
    revalidatePath("/pre-onboarding");
    revalidatePath("/documents");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fill] Submit error:", error);
    return NextResponse.json({ success: false, error: "Failed to process" }, { status: 500 });
  }
}
