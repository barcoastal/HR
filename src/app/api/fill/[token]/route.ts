import { extractPdfFormFields, submitFilledForm } from "@/lib/actions/filling";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await extractPdfFormFields(token);

  if (!result) {
    return NextResponse.json({ error: "Invalid or expired request" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { fieldValues, textOverlays, signatureBase64 } = body;

  const result = await submitFilledForm(token, fieldValues || {}, textOverlays || [], signatureBase64);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
