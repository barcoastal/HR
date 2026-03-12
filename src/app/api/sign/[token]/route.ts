import { getSigningRequestByToken, submitSignature } from "@/lib/actions/signing";
import { sendSigningConfirmationEmail } from "@/lib/email";
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

  return NextResponse.json({
    documentUrl: signingRequest.documentUrl,
    documentName: signingRequest.documentName,
    employeeName: `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}`,
    status: signingRequest.status,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { signatureBase64 } = body;

  if (!signatureBase64) {
    return NextResponse.json({ error: "Signature required" }, { status: 400 });
  }

  const result = await submitSignature(token, signatureBase64);

  if (result.success) {
    // Send confirmation email (fire and forget)
    const signingRequest = await getSigningRequestByToken(token);
    if (signingRequest) {
      sendSigningConfirmationEmail({
        to: signingRequest.employee.email,
        firstName: signingRequest.employee.firstName,
        documentName: signingRequest.documentName,
      });
    }
  }

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
