export const AVAILABLE_PLACEHOLDERS = [
  { key: "{{firstName}}", description: "Candidate first name" },
  { key: "{{lastName}}", description: "Candidate last name" },
  { key: "{{fullName}}", description: "Candidate full name" },
  { key: "{{email}}", description: "Candidate email" },
  { key: "{{phone}}", description: "Candidate phone" },
  { key: "{{hourlyRate}}", description: "Hourly rate" },
  { key: "{{position}}", description: "Position applied to" },
  { key: "{{date}}", description: "Today's date" },
  { key: "{{startDate}}", description: "Employee start date" },
  { key: "{{company}}", description: "Company name" },
];

// Signature-only placeholders (only shown when doc action is Sign or Fill)
export const SIGNATURE_PLACEHOLDERS = [
  { key: "{{signature}}", description: "Signer's signature" },
  { key: "{{signatureDate}}", description: "Date signed" },
];

// Countersignature placeholders (only shown when requiresCountersignature is on)
export const COUNTERSIGNATURE_PLACEHOLDERS = [
  { key: "{{countersignature}}", description: "Countersigner (HR/management) signature" },
  { key: "{{countersignatureDate}}", description: "Date countersigned" },
];

const SIG_KINDS = new Set([
  "{{signature}}",
  "{{signatureDate}}",
  "{{countersignature}}",
  "{{countersignatureDate}}",
]);

export function isSignaturePlaceholder(placeholder: string): boolean {
  return SIG_KINDS.has(placeholder);
}

export type PlacementKind = "signature" | "signatureDate" | "countersignature" | "countersignatureDate";

export type SignaturePlacement = {
  page: number;        // 1-indexed
  xPct: number;        // 0..1, left edge of box relative to page width
  yPct: number;        // 0..1, top edge of box relative to page height
  widthPct: number;    // 0..1
  heightPct: number;   // 0..1
  kind: PlacementKind;
};

function placeholderToKind(placeholder: string): PlacementKind | null {
  switch (placeholder) {
    case "{{signature}}": return "signature";
    case "{{signatureDate}}": return "signatureDate";
    case "{{countersignature}}": return "countersignature";
    case "{{countersignatureDate}}": return "countersignatureDate";
    default: return null;
  }
}

type CandidateData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  hourlyRate: number | null;
  position: { title: string } | null;
  startDate?: string | Date | null;
};

export function resolvePlaceholder(
  placeholder: string,
  candidate: CandidateData,
  companyName: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const startDateStr = candidate.startDate
    ? new Date(candidate.startDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "N/A";

  const map: Record<string, string> = {
    "{{firstName}}": candidate.firstName,
    "{{lastName}}": candidate.lastName,
    "{{fullName}}": `${candidate.firstName} ${candidate.lastName}`,
    "{{email}}": candidate.email,
    "{{phone}}": candidate.phone || "N/A",
    "{{hourlyRate}}": candidate.hourlyRate ? `$${candidate.hourlyRate.toFixed(2)}/hr` : "N/A",
    "{{position}}": candidate.position?.title || "N/A",
    "{{date}}": dateStr,
    "{{startDate}}": startDateStr,
    "{{company}}": companyName,
  };

  return map[placeholder] || placeholder;
}

export function fillPlaceholders(
  content: string,
  candidate: CandidateData,
  companyName: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const startDateStr = candidate.startDate
    ? new Date(candidate.startDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "N/A";

  return content
    .replace(/\{\{firstName\}\}/g, candidate.firstName)
    .replace(/\{\{lastName\}\}/g, candidate.lastName)
    .replace(/\{\{fullName\}\}/g, `${candidate.firstName} ${candidate.lastName}`)
    .replace(/\{\{email\}\}/g, candidate.email)
    .replace(/\{\{phone\}\}/g, candidate.phone || "N/A")
    .replace(
      /\{\{hourlyRate\}\}/g,
      candidate.hourlyRate ? `$${candidate.hourlyRate.toFixed(2)}/hr` : "N/A"
    )
    .replace(/\{\{position\}\}/g, candidate.position?.title || "N/A")
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{startDate\}\}/g, startDateStr)
    .replace(/\{\{company\}\}/g, companyName);
}

type PlaceholderPosition = {
  id: string;
  page: number;
  x: number;
  y: number;
  placeholder: string;
  fontSize: number;
};

export async function fillPdfPlaceholders(
  pdfBase64: string,
  positions: PlaceholderPosition[],
  candidate: CandidateData,
  companyName: string
): Promise<{ pdf: Uint8Array; signaturePlacements: SignaturePlacement[] }> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  // Decode base64 — strip any whitespace/newlines that may have been added
  const cleanBase64 = pdfBase64.replace(/\s/g, "");
  const pdfBytes = Buffer.from(cleanBase64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const signaturePlacements: SignaturePlacement[] = [];

  // Default rendered box size (as % of page) used by the signer-side overlay
  const DEFAULT_SIG_WIDTH_PCT = 0.26; // ~26% of page width
  const DEFAULT_SIG_HEIGHT_PCT = 0.08;
  const DEFAULT_DATE_WIDTH_PCT = 0.18;
  const DEFAULT_DATE_HEIGHT_PCT = 0.04;

  for (const pos of positions) {
    const pageIndex = pos.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    // Signature placeholders are NOT stamped as text — they are deferred to signing time.
    const kind = placeholderToKind(pos.placeholder);
    if (kind) {
      const isSigLike = kind === "signature" || kind === "countersignature";
      const widthPct = isSigLike ? DEFAULT_SIG_WIDTH_PCT : DEFAULT_DATE_WIDTH_PCT;
      const heightPct = isSigLike ? DEFAULT_SIG_HEIGHT_PCT : DEFAULT_DATE_HEIGHT_PCT;
      const centerX = pos.x / 100;
      const centerY = pos.y / 100;
      signaturePlacements.push({
        page: pos.page,
        xPct: Math.max(0, Math.min(1 - widthPct, centerX - widthPct / 2)),
        yPct: Math.max(0, Math.min(1 - heightPct, centerY - heightPct / 2)),
        widthPct,
        heightPct,
        kind,
      });
      continue;
    }

    const page = pages[pageIndex];
    const { width, height } = page.getSize();
    const text = resolvePlaceholder(pos.placeholder, candidate, companyName);
    const fontSize = pos.fontSize || 12;

    // x/y are percentages — convert to PDF coordinates
    // PDF origin is bottom-left, UI origin is top-left
    const xPos = (pos.x / 100) * width;
    const yPos = height - (pos.y / 100) * height;

    // Center the text on the marker position
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: xPos - textWidth / 2,
      y: yPos - fontSize / 2,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const pdf = await pdfDoc.save();
  return { pdf, signaturePlacements };
}
