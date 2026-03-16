import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json({ error: "Add ?to=your@email.com" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY not set", env: Object.keys(process.env).filter(k => k.includes("RESEND")) });

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: "Test email from Coastal HR",
      html: "<h1>It works!</h1><p>Email sending is configured correctly.</p>",
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
