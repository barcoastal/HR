import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

// Public endpoint — submit a job application
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const phone = (formData.get("phone") as string) || null;
    const positionId = formData.get("positionId") as string;
    const resume = formData.get("resume") as File | null;

    if (!firstName || !lastName || !email || !positionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify position exists and is published
    const position = await db.position.findUnique({ where: { id: positionId } });
    if (!position || position.status !== "OPEN" || !position.published) {
      return NextResponse.json({ error: "Position not available" }, { status: 404 });
    }

    // Check for duplicate application
    const existing = await db.candidate.findFirst({
      where: { email, positionId },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already applied for this position" }, { status: 409 });
    }

    // Store resume if provided
    let resumeUrl: string | null = null;
    if (resume && resume.size > 0) {
      const buffer = Buffer.from(await resume.arrayBuffer());
      const filename = `${randomUUID()}.pdf`;
      await db.fileBlob.create({
        data: {
          filename,
          mimeType: resume.type || "application/pdf",
          size: buffer.length,
          data: buffer,
        },
      });
      resumeUrl = `/api/onboarding-docs/${filename}`;
    }

    // Create candidate
    const candidate = await db.candidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        positionId,
        source: "careers-page",
        status: "NEW",
        inPipeline: true,
        resumeUrl,
      },
    });

    // Notify via rules engine
    try {
      const { sendNotifications } = await import("@/lib/notifications/send");
      await sendNotifications({
        action: "NEW_APPLICATION",
        message: `New application: ${firstName} ${lastName} for ${position.title}`,
        link: "/cv",
        emailSubject: `New Application: ${firstName} ${lastName} — ${position.title}`,
        emailBody: `<p><strong>${firstName} ${lastName}</strong> applied for <strong>${position.title}</strong> via the careers page.</p><p>Email: ${email}${phone ? `<br>Phone: ${phone}` : ""}</p>`,
      });
    } catch (e) {
      console.error("[careers] Notification error:", e);
    }

    return NextResponse.json({ success: true, candidateId: candidate.id });
  } catch (error) {
    console.error("[careers/apply] Error:", error);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
