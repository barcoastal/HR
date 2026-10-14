import { db } from "@/lib/db";
import { PDFDocument } from "pdf-lib";
import { readStoredPlacements, stampFillSignature } from "@/lib/signing-stamp";
import { resolveTextValuesForSigning } from "@/lib/text-box-fields";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { pageImages, signatureBase64, sigPosition, fieldValues } = body;

  const signingRequest = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });
  if (!signingRequest || signingRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 404 });
  }

  if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
    return NextResponse.json({ error: "No page images" }, { status: 400 });
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

    // Same stamping as the final submit, so the preview matches the result.
    const placements = readStoredPlacements(signingRequest.signaturePlacements);
    await stampFillSignature(pdfDoc, placements, {
      signatureBase64,
      sigPosition,
      signerName: signingRequest.signerName
        || (signingRequest.employee ? `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}` : "Employee"),
      textValues: resolveTextValuesForSigning(placements, fieldValues).values,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[fill/preview] Error:", err);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
