"use server";

import { db } from "@/lib/db";
import { PDFDocument, rgb } from "pdf-lib";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export type PdfFormField = {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "radio";
  value: string;
  options?: string[];
};

export type DetectedField = {
  id: string;
  label: string;
  type: "text" | "date" | "ssn" | "phone" | "email" | "number" | "checkbox";
  page: number;       // 0-indexed
  xPercent: number;   // position on page (0-100)
  yPercent: number;
  required: boolean;
  fontSize?: number;  // recommended font size
  section?: string;   // group label
};

export type TextOverlay = {
  page: number;
  xPercent: number;
  yPercent: number;
  text: string;
  fontSize?: number;
};

export async function extractPdfFormFields(token: string): Promise<{
  fields: PdfFormField[];
  detectedFields: DetectedField[];
  pageCount: number;
  documentName: string;
  employeeName: string;
  status: string;
} | null> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request || request.expiresAt < new Date()) return null;
  if (request.status === "SIGNED" || request.status === "VOIDED") return null;

  // Mark as viewed
  if (request.status === "PENDING") {
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  const docFilename = request.documentUrl.split("/").pop();
  if (!docFilename) return null;

  const fileBlob = await db.fileBlob.findUnique({
    where: { filename: docFilename },
    select: { data: true },
  });
  if (!fileBlob) return null;

  let fields: PdfFormField[] = [];
  let pageCount = 1;

  try {
    const pdfDoc = await PDFDocument.load(fileBlob.data, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();

    const form = pdfDoc.getForm();
    const pdfFields = form.getFields();
    console.log(`[filling] Found ${pdfFields.length} AcroForm fields in "${request.documentName}"`);

    for (const field of pdfFields) {
      const name = field.getName();
      const typeName = field.constructor.name;
      try {
        if (typeName === "PDFTextField") {
          const tf = form.getTextField(name);
          fields.push({ name, type: "text", value: tf.getText() || "" });
        } else if (typeName === "PDFCheckBox") {
          const cb = form.getCheckBox(name);
          fields.push({ name, type: "checkbox", value: cb.isChecked() ? "true" : "false" });
        } else if (typeName === "PDFDropdown") {
          const dd = form.getDropdown(name);
          fields.push({ name, type: "dropdown", value: dd.getSelected()?.[0] || "", options: dd.getOptions() });
        } else if (typeName === "PDFRadioGroup") {
          const rg = form.getRadioGroup(name);
          fields.push({ name, type: "radio", value: rg.getSelected() || "", options: rg.getOptions() });
        }
      } catch (e) {
        console.warn(`[filling] Could not read field "${name}" (${typeName}):`, e);
      }
    }
  } catch (e) {
    console.error("[filling] Failed to parse PDF form fields:", e);
  }

  // If no AcroForm fields, use Claude to analyze the PDF
  let detectedFields: DetectedField[] = [];
  if (fields.length === 0) {
    try {
      detectedFields = await analyzePdfWithClaude(fileBlob.data, request.documentName);
      console.log(`[filling] Claude detected ${detectedFields.length} fields in "${request.documentName}"`);
    } catch (e) {
      console.error("[filling] Claude PDF analysis failed:", e);
    }
  }

  const employeeName = request.signerName
    || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Employee");

  return {
    fields,
    detectedFields,
    pageCount,
    documentName: request.documentName,
    employeeName,
    status: request.status,
  };
}

async function analyzePdfWithClaude(pdfData: Buffer | Uint8Array, documentName: string): Promise<DetectedField[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const pdfBase64 = Buffer.from(pdfData).toString("base64");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this PDF form "${documentName}" and find every blank field/box/line that needs to be filled in.

IMPORTANT RULES:
- Scan ALL pages of the document, not just page 1
- Include ALL fields the employee/person needs to fill — every blank line, text box, checkbox, and date field
- For forms like I-9: include Section 1 employee fields AND Supplement A/B fields on later pages if present
- Skip employer-only sections (Section 2, Section 3 of I-9) and printed instructions

POSITIONING — this is critical, the text will be drawn at these exact coordinates:
- xPercent: the LEFT EDGE of where the text should START inside the blank field (0=page left margin, 100=page right margin)
- yPercent: the VERTICAL CENTER of the blank field/line (0=very top of page, 100=very bottom)
- The position must be INSIDE the white fillable area, NOT on the label text
- For a field labeled "Last Name" with a blank box to its right, xPercent should be the left edge of the blank box, NOT the label position

For each field return:
- id: unique snake_case identifier (e.g. "last_name", "ssn", "street_address")
- label: human-readable label exactly as shown on the form
- type: "text" | "date" | "ssn" | "phone" | "email" | "number" | "checkbox"
- page: 0-indexed page number
- xPercent: horizontal position (0-100) — left edge of the blank field
- yPercent: vertical position (0-100) — center of the blank field
- required: boolean
- fontSize: recommended font size in points (typically 8-10 for form fields)
- section: section/group name from the form

Return ONLY a valid JSON array, no markdown, no explanation:
[{"id":"...","label":"...","type":"...","page":0,"xPercent":0,"yPercent":0,"required":true,"fontSize":9,"section":"..."}]`,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return [];

  // Extract JSON from response
  let jsonStr = textContent.text.trim();
  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f: DetectedField) => ({
      id: f.id || randomUUID(),
      label: f.label || "Unknown Field",
      type: f.type || "text",
      page: f.page || 0,
      xPercent: f.xPercent || 0,
      yPercent: f.yPercent || 0,
      required: f.required ?? false,
      fontSize: f.fontSize || 9,
      section: f.section || undefined,
    }));
  } catch (e) {
    console.error("[filling] Failed to parse Claude response:", e, jsonStr);
    return [];
  }
}

export async function submitFilledForm(
  token: string,
  fieldValues: Record<string, string>,
  textOverlays?: TextOverlay[],
  signatureBase64?: string
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!request || request.status === "SIGNED" || request.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired request" };
  }

  try {
    const docFilename = request.documentUrl.split("/").pop();
    if (!docFilename) return { success: false, error: "Invalid document URL" };

    const fileBlob = await db.fileBlob.findUnique({
      where: { filename: docFilename },
      select: { data: true },
    });
    if (!fileBlob) return { success: false, error: "Could not fetch document" };

    const pdfDoc = await PDFDocument.load(fileBlob.data, { ignoreEncryption: true });

    // Mode 1: Fill AcroForm fields
    if (Object.keys(fieldValues).length > 0) {
      try {
        const form = pdfDoc.getForm();
        for (const [name, value] of Object.entries(fieldValues)) {
          try {
            const field = form.getField(name);
            const typeName = field.constructor.name;
            if (typeName === "PDFTextField") {
              form.getTextField(name).setText(value);
            } else if (typeName === "PDFCheckBox") {
              const cb = form.getCheckBox(name);
              if (value === "true") cb.check(); else cb.uncheck();
            } else if (typeName === "PDFDropdown") {
              form.getDropdown(name).select(value);
            } else if (typeName === "PDFRadioGroup") {
              form.getRadioGroup(name).select(value);
            }
          } catch {
            // Field not found in form — skip
          }
        }
        form.flatten();
      } catch {
        // No form in this PDF — skip
      }
    }

    // Mode 2: Draw text overlays on pages
    if (textOverlays && textOverlays.length > 0) {
      const pages = pdfDoc.getPages();
      for (const overlay of textOverlays) {
        if (overlay.page < 0 || overlay.page >= pages.length || !overlay.text.trim()) continue;
        const page = pages[overlay.page];
        const { width, height } = page.getSize();
        const x = (overlay.xPercent / 100) * width;
        // yPercent is the vertical CENTER of the field (0=top, 100=bottom)
        // PDF coordinates: 0=bottom, height=top — so we flip and center the text
        const fontSize = overlay.fontSize || 9;
        const y = height - (overlay.yPercent / 100) * height - (fontSize / 2);

        page.drawText(overlay.text, {
          x,
          y,
          size: fontSize,
          color: rgb(0.05, 0.05, 0.15),
        });
      }
    }

    // Add signature if provided
    if (signatureBase64) {
      const sigImageBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
      const sigImage = await pdfDoc.embedPng(sigImageBytes);

      // Find the signature field page — look for the last overlay page, or default to first page
      const sigPage = textOverlays && textOverlays.length > 0
        ? pdfDoc.getPages()[textOverlays[textOverlays.length - 1].page] || pdfDoc.getPages()[0]
        : pdfDoc.getPages()[0];

      const { width: pageWidth } = sigPage.getSize();
      const sigWidth = Math.min(150, pageWidth * 0.25);
      const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

      // Place signature at bottom-left area
      sigPage.drawImage(sigImage, {
        x: 72,
        y: 60,
        width: sigWidth,
        height: sigHeight,
      });

      // Add date next to signature
      const signerName = request.signerName || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Signer");
      const signDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      sigPage.drawText(`Signed by ${signerName} on ${signDate}`, {
        x: 72,
        y: 48,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    const filledPdfBytes = await pdfDoc.save();

    // Store filled PDF
    const filledFilename = `${randomUUID()}.pdf`;
    const filledBuffer = Buffer.from(filledPdfBytes);
    await db.fileBlob.create({
      data: {
        filename: filledFilename,
        mimeType: "application/pdf",
        size: filledBuffer.length,
        data: filledBuffer,
      },
    });
    const filledDocUrl = `/api/onboarding-docs/${filledFilename}`;

    // Update signing request as completed
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "SIGNED", signedAt: new Date(), signedDocUrl: filledDocUrl },
    });

    // Auto-complete the employee task
    if (request.employeeTaskId) {
      await db.employeeTask.update({
        where: { id: request.employeeTaskId },
        data: { status: "DONE", completedAt: new Date() },
      });
    }

    // Store in employee documents
    if (request.employeeId) {
      await db.document.create({
        data: {
          employeeId: request.employeeId,
          name: `Filled: ${request.documentName}`,
          url: filledDocUrl,
          category: "ONBOARDING",
        },
      });
    }

    // Send confirmation email
    const recipientEmail = request.signerEmail || request.employee?.email;
    const recipientName = request.signerName || (request.employee ? request.employee.firstName : "there");
    if (recipientEmail) {
      try {
        const { sendFillConfirmationEmail } = await import("@/lib/email");
        await sendFillConfirmationEmail({
          to: recipientEmail,
          firstName: recipientName,
          documentName: request.documentName,
        });
      } catch (e) {
        console.error("[filling] Failed to send confirmation email:", e);
      }
    }

    revalidatePath("/onboarding");
    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Filling error:", error);
    return { success: false, error: "Failed to process filled document" };
  }
}
