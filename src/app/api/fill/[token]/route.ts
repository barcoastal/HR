import { extractPdfFormFields, submitFilledForm } from "@/lib/actions/filling";
import { sendFillConfirmationEmail } from "@/lib/email";
import { db } from "@/lib/db";
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
  const { fieldValues } = body;

  if (!fieldValues || typeof fieldValues !== "object") {
    return NextResponse.json({ error: "Field values required" }, { status: 400 });
  }

  const result = await submitFilledForm(token, fieldValues);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
