import { db } from "@/lib/db";
import { PDFDocument, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { fieldValues, signatureBase64 } = body;

  const signingRequest = await db.signingRequest.findUnique({ where: { token } });
  if (!signingRequest || signingRequest.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 404 });
  }

  const docFilename = signingRequest.documentUrl.split("/").pop();
  if (!docFilename) return NextResponse.json({ error: "Invalid doc" }, { status: 400 });

  const fileBlob = await db.fileBlob.findUnique({
    where: { filename: docFilename },
    select: { data: true },
  });
  if (!fileBlob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const pdfDoc = await PDFDocument.load(fileBlob.data, { ignoreEncryption: true });

    // Try to fill AcroForm fields
    if (fieldValues && Object.keys(fieldValues).length > 0) {
      try {
        const form = pdfDoc.getForm();
        for (const [name, value] of Object.entries(fieldValues)) {
          try {
            const field = form.getField(name);
            const typeName = field.constructor.name;
            if (typeName === "PDFTextField") {
              form.getTextField(name).setText(value as string);
            } else if (typeName === "PDFCheckBox") {
              const cb = form.getCheckBox(name);
              if (value === "true") cb.check(); else cb.uncheck();
            } else if (typeName === "PDFDropdown") {
              form.getDropdown(name).select(value as string);
            }
          } catch { /* field not found */ }
        }
        form.flatten();
      } catch { /* no form */ }
    }

    // Add signature
    if (signatureBase64) {
      const sigBytes = Buffer.from((signatureBase64 as string).replace(/^data:image\/png;base64,/, ""), "base64");
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      const sigWidth = 150;
      const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

      lastPage.drawImage(sigImage, { x: 72, y: 60, width: sigWidth, height: sigHeight });
      const signerName = signingRequest.signerName || "Employee";
      const signDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      lastPage.drawText(`Signed by ${signerName} on ${signDate}`, {
        x: 72, y: 48, size: 8, color: rgb(0.4, 0.4, 0.4),
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
