import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json({ error: "Add ?to=your@email.com" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not set", envKeys: Object.keys(process.env).filter(k => k.includes("RESEND")) });

  // Load company settings to debug
  let settings = null;
  try {
    settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
  } catch (e) {
    return NextResponse.json({ error: "DB query failed", detail: String(e) });
  }

  const senderEmail = settings?.senderEmail?.trim() || "noreply@hr.coastaldebt-tools.com";
  const senderName = settings?.senderName?.trim() || "Coastal HR";
  const from = `${senderName} <${senderEmail}>`;

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "Test email from Coastal HR",
    html: "<h1>It works!</h1><p>Email sending is configured correctly.</p>",
  });

  return NextResponse.json({
    success: !error,
    from,
    senderEmail,
    senderName,
    dbSenderEmail: settings?.senderEmail,
    dbSenderName: settings?.senderName,
    resendData: data,
    resendError: error,
  });
}
