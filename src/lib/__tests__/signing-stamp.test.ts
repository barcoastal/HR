import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { stampFillSignature, stampPrimaryPlacements } from "@/lib/signing-stamp";
import type { SignaturePlacement } from "@/lib/stage-document-utils";

// 1x1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function twoPagePdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  pdf.addPage([612, 792]);
  return pdf;
}

const sig: SignaturePlacement = { page: 2, xPct: 0.1, yPct: 0.8, widthPct: 0.26, heightPct: 0.08, kind: "signature" };
const text: SignaturePlacement = {
  page: 1, xPct: 0.1, yPct: 0.2, widthPct: 0.24, heightPct: 0.05, kind: "freeText", fieldId: "f1", label: "Phone", filledBy: "admin", value: "x",
};

describe("stampPrimaryPlacements", () => {
  it("stamps text (including characters the standard font lacks) without throwing", async () => {
    const pdf = await twoPagePdf();
    expect(() =>
      stampPrimaryPlacements(pdf, [text, { ...sig, kind: "countersignature" }], {
        signerName: "Test Person",
        signDate: "January 1, 2026",
        textValues: { f1: "555-0100 ✓ 👋" },
      })
    ).not.toThrow();
    const bytes = await pdf.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe("stampFillSignature", () => {
  it("uses HR's placed signature box instead of the tapped spot", async () => {
    const pdf = await twoPagePdf();
    const page2 = pdf.getPages()[1];
    const drawn: { x: number; y: number }[] = [];
    const original = page2.drawImage.bind(page2);
    page2.drawImage = ((img, opts) => {
      drawn.push({ x: opts!.x!, y: opts!.y! });
      return original(img, opts);
    }) as typeof page2.drawImage;

    await stampFillSignature(pdf, [sig], {
      signatureBase64: PNG,
      sigPosition: { page: 0, xPercent: 90, yPercent: 5 },
      signerName: "Test Person",
    });

    expect(drawn).toHaveLength(1);
    // Inside the placed box on page 2 (x from 61.2 to ~220)
    expect(drawn[0].x).toBeGreaterThanOrEqual(61.2);
    expect(drawn[0].x).toBeLessThan(0.36 * 612);
  });

  it("falls back to the tapped spot when no signature box was placed", async () => {
    const pdf = await twoPagePdf();
    const page1 = pdf.getPages()[0];
    let calls = 0;
    const original = page1.drawImage.bind(page1);
    page1.drawImage = ((img, opts) => {
      calls++;
      expect(opts!.x).toBeCloseTo(0.5 * 612);
      return original(img, opts);
    }) as typeof page1.drawImage;

    await stampFillSignature(pdf, [], {
      signatureBase64: PNG,
      sigPosition: { page: 0, xPercent: 50, yPercent: 50 },
      signerName: "Test Person",
    });
    expect(calls).toBe(1);
  });
});
