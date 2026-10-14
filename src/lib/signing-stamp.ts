import { rgb, type PDFDocument, type PDFImage } from "pdf-lib";
import { toPdfSafeText } from "@/lib/text-box-fields";
import type { SignaturePlacement } from "@/lib/stage-document-utils";

/** Placement kinds the primary signer (not the countersigner) completes. */
const PRIMARY_KINDS = new Set(["signature", "signatureDate", "initials", "freeText"]);

export function readStoredPlacements(json: unknown): SignaturePlacement[] {
  return Array.isArray(json) ? (json as SignaturePlacement[]) : [];
}

export function hasPlacedSignature(placements: readonly SignaturePlacement[]): boolean {
  return placements.some((p) => p.kind === "signature");
}

function fitImage(image: PDFImage, boxX: number, boxY: number, boxWidth: number, boxHeight: number) {
  const ratio = image.width / image.height;
  let drawW = boxWidth;
  let drawH = drawW / ratio;
  if (drawH > boxHeight) {
    drawH = boxHeight;
    drawW = drawH * ratio;
  }
  return { x: boxX + (boxWidth - drawW) / 2, y: boxY + (boxHeight - drawH) / 2, width: drawW, height: drawH };
}

/**
 * Signature step of the "fill" flow (/fill/[token]). When HR placed signature
 * boxes, the signature goes in those boxes (plus dates and text boxes);
 * otherwise it goes where the recipient tapped (`sigPosition`), as before.
 */
export async function stampFillSignature(
  pdfDoc: PDFDocument,
  placements: readonly SignaturePlacement[],
  opts: {
    signatureBase64?: string | null;
    sigPosition?: { page?: number; xPercent: number; yPercent: number } | null;
    signerName: string;
    textValues?: Record<string, string>;
  }
) {
  const signDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const sigImage = opts.signatureBase64
    ? await pdfDoc.embedPng(Buffer.from(opts.signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64"))
    : null;
  const usePlaced = hasPlacedSignature(placements);

  stampPrimaryPlacements(pdfDoc, placements, {
    sigImage: usePlaced ? sigImage : null,
    signerName: opts.signerName,
    signDate,
    textValues: opts.textValues,
  });

  if (usePlaced || !sigImage || !opts.sigPosition) return;

  // Legacy: signature block at the spot the recipient tapped
  const pages = pdfDoc.getPages();
  const page = pages[Math.max(0, Math.min(opts.sigPosition.page || 0, pages.length - 1))];
  const { width: pw, height: ph } = page.getSize();
  const sigWidth = Math.min(150, pw * 0.22);
  const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
  const x = (opts.sigPosition.xPercent / 100) * pw;
  const y = ph - (opts.sigPosition.yPercent / 100) * ph - sigHeight;

  page.drawImage(sigImage, { x, y, width: sigWidth, height: sigHeight });
  page.drawLine({ start: { x, y: y - 2 }, end: { x: x + sigWidth, y: y - 2 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(toPdfSafeText(opts.signerName), { x, y: y - 14, size: 9, color: rgb(0.1, 0.1, 0.15) });
  page.drawText(signDate, { x, y: y - 25, size: 8, color: rgb(0.35, 0.35, 0.4) });
}

/**
 * Stamps the primary signer's placements (signature, date, initials, text
 * boxes) onto the PDF at the boxes HR placed. Countersignature boxes are left
 * for the countersigner.
 */
export function stampPrimaryPlacements(
  pdfDoc: PDFDocument,
  placements: readonly SignaturePlacement[],
  opts: {
    sigImage?: PDFImage | null;
    initialsImage?: PDFImage | null;
    signerName: string;
    signDate: string;
    textValues?: Record<string, string>;
  }
) {
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return;
  for (const p of placements) {
    if (!PRIMARY_KINDS.has(p.kind)) continue;
    const target = pages[Math.max(0, Math.min(pages.length - 1, p.page - 1))];
    const { width: pageWidth, height: pageHeight } = target.getSize();
    const boxX = p.xPct * pageWidth;
    const boxWidth = p.widthPct * pageWidth;
    const boxHeight = p.heightPct * pageHeight;
    const boxY = pageHeight - p.yPct * pageHeight - boxHeight;

    if (p.kind === "signature") {
      if (!opts.sigImage) continue;
      target.drawImage(opts.sigImage, fitImage(opts.sigImage, boxX, boxY, boxWidth, boxHeight));
      // Signer's full name directly below the signature box
      target.drawText(toPdfSafeText(opts.signerName), { x: boxX, y: boxY - 10, size: 8, color: rgb(0.15, 0.15, 0.2) });
    } else if (p.kind === "initials") {
      if (!opts.initialsImage) continue;
      target.drawImage(opts.initialsImage, fitImage(opts.initialsImage, boxX, boxY, boxWidth, boxHeight));
    } else if (p.kind === "freeText") {
      const value = (p.fieldId && opts.textValues?.[p.fieldId]) || "";
      if (!value) continue;
      const fontSize = Math.min(11, boxHeight * 0.7);
      target.drawText(toPdfSafeText(value), {
        x: boxX + 2,
        y: boxY + (boxHeight - fontSize) / 2 + 1,
        size: fontSize,
        color: rgb(0.1, 0.1, 0.15),
        maxWidth: Math.max(1, boxWidth - 4),
      });
    } else {
      const fontSize = Math.min(12, boxHeight * 0.7);
      target.drawText(opts.signDate, {
        x: boxX + 2,
        y: boxY + (boxHeight - fontSize) / 2 + 1,
        size: fontSize,
        color: rgb(0.1, 0.1, 0.15),
      });
    }
  }
}
