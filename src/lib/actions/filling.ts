"use server";

import { db } from "@/lib/db";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export type PdfFormField = {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "radio";
  value: string;
  options?: string[]; // for dropdowns
};

export async function extractPdfFormFields(token: string): Promise<{
  fields: PdfFormField[];
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

  const pdfDoc = await PDFDocument.load(fileBlob.data);
  const form = pdfDoc.getForm();
  const pdfFields = form.getFields();

  const fields: PdfFormField[] = [];
  for (const field of pdfFields) {
    const name = field.getName();
    const typeName = field.constructor.name;

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
  }

  const employeeName = request.signerName
    || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Employee");

  return {
    fields,
    documentName: request.documentName,
    employeeName,
    status: request.status,
  };
}

export async function submitFilledForm(
  token: string,
  fieldValues: Record<string, string>
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

    const pdfDoc = await PDFDocument.load(fileBlob.data);
    const form = pdfDoc.getForm();

    // Fill in the form fields
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
      } catch (e) {
        console.warn(`[filling] Could not set field "${name}":`, e);
      }
    }

    // Flatten the form so fields are no longer editable
    form.flatten();

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

    // Update signing request as completed (reuse SIGNED status)
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
