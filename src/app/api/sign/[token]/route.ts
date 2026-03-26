import { getSigningRequestByToken, submitSignature } from "@/lib/actions/signing";
import { sendSigningConfirmationEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signingRequest = await getSigningRequestByToken(token);

  if (!signingRequest) {
    return NextResponse.json({ error: "Invalid or expired signing request" }, { status: 404 });
  }

  const signerName = signingRequest.signerName
    || (signingRequest.employee ? `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}` : "Signer");

  return NextResponse.json({
    documentUrl: signingRequest.documentUrl,
    documentName: signingRequest.documentName,
    employeeName: signerName,
    status: signingRequest.status,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { signatureBase64, signaturePosition } = body;

  if (!signatureBase64) {
    return NextResponse.json({ error: "Signature required" }, { status: 400 });
  }

  const result = await submitSignature(token, signatureBase64, signaturePosition);

  if (result.success) {
    // Send confirmation email (fire and forget) — re-fetch from DB since status changed
    const confirmed = await db.signingRequest.findUnique({
      where: { token },
      include: { employee: true },
    });
    if (confirmed) {
      const confirmEmail = confirmed.signerEmail || confirmed.employee?.email;
      const confirmName = confirmed.signerName || (confirmed.employee ? confirmed.employee.firstName : "there");
      if (confirmEmail) {
        sendSigningConfirmationEmail({
          to: confirmEmail,
          firstName: confirmName,
          documentName: confirmed.documentName,
        });
      }
    }
  }

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
