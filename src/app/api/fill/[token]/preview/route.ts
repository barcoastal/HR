import { db } from "@/lib/db";
import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { pageImages, signatureBase64 } = body;

  const signingRequest = await db.signingRequest.findUnique({ where: { token } });
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

      // Standard US Letter size in points
      const pageWidth = 612;
      const pageHeight = (img.height / img.width) * pageWidth;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }

    // Add signature to first page
    if (signatureBase64) {
      const sigBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const firstPage = pdfDoc.getPages()[0];
      const { width: pw, height: ph } = firstPage.getSize();
      const sigWidth = Math.min(130, pw * 0.2);
      const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

      // Place near bottom of page 1 — where signature lines typically are (~15% from bottom)
      firstPage.drawImage(sigImage, {
        x: pw * 0.05,
        y: ph * 0.12,
        width: sigWidth,
        height: sigHeight,
      });
    }

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
