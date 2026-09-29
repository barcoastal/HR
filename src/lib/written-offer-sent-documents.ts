import { db } from "@/lib/db";

/**
 * Put a document that went out as a plain email attachment on the person's
 * Written Offer card. Attachments need no signature, so without this record
 * there is no sign anywhere that they were sent. It never holds the person in
 * Written Offer: only sign/fill documents do.
 */
export async function recordSentWrittenOfferDocument(employeeId: string, document: { name: string; url: string }) {
  const existing = await db.employeeTask.findFirst({
    where: { employeeId, documentAction: "SEND", documentName: document.name, checklistItemId: null },
    select: { id: true },
  });

  if (existing) {
    // A resend replaces the earlier record instead of listing the document twice.
    await db.employeeTask.update({
      where: { id: existing.id },
      data: { status: "DONE", completedAt: new Date(), documentUrl: document.url },
    });
    return;
  }

  await db.employeeTask.create({
    data: {
      employeeId,
      title: document.name,
      description: "Sent by email as an attachment. No signature required.",
      documentAction: "SEND",
      documentName: document.name,
      documentUrl: document.url,
      status: "DONE",
      completedAt: new Date(),
    },
  });
}
