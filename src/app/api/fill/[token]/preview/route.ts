import { db } from "@/lib/db";
import { PDFDocument, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { pageImages, signatureBase64, sigPosition } = body;

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

      // Signature image
      page.drawImage(sigImage, { x, y, width: sigWidth, height: sigHeight });
      // Line under signature
      page.drawLine({
        start: { x, y: y - 2 },
        end: { x: x + sigWidth, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
      // Name
      page.drawText(signerName, {
        x, y: y - 14, size: 9,
        color: rgb(0.1, 0.1, 0.15),
      });
      // Date
      page.drawText(signDate, {
        x, y: y - 25, size: 8,
        color: rgb(0.35, 0.35, 0.4),
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
