import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { sendSigningRequestEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Add ?email=bar@coastaldebt.com" }, { status: 400 });

  try {
    // Find employee
    const employee = await db.employee.findFirst({ where: { email } });
    if (!employee) return NextResponse.json({ error: `No employee found with email: ${email}` });

    // Find their latest document
    const doc = await db.document.findFirst({
      where: { employeeId: employee.id },
      orderBy: { uploadedAt: "desc" },
    });
    if (!doc) return NextResponse.json({ error: "No documents found for this employee" });

    // Create task
    const employeeTask = await db.employeeTask.create({
      data: {
        employeeId: employee.id,
        title: `Sign: ${doc.name}`,
        description: `Please review and sign ${doc.name}`,
        documentAction: "SIGN",
        documentUrl: doc.url,
        documentName: doc.name,
        status: "PENDING",
      },
    });

    // Create signing request
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.signingRequest.create({
      data: {
        employeeTaskId: employeeTask.id,
        employeeId: employee.id,
        token,
        documentUrl: doc.url,
        documentName: doc.name,
        expiresAt,
      },
    });

    // Send email
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const signingUrl = `${baseUrl}/sign/${token}`;

    await sendSigningRequestEmail({
      to: employee.email,
      firstName: employee.firstName,
      documentName: doc.name,
      signingUrl,
    });

    return NextResponse.json({
      success: true,
      signingUrl,
      employee: `${employee.firstName} ${employee.lastName}`,
      document: doc.name,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
