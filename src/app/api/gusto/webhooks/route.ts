import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/gusto";

export async function POST(request: Request) {
  // 1. Look up connection
  const conn = await db.gustoConnection.findFirst();
  if (!conn || !conn.webhookSecret) {
    return NextResponse.json({ error: "No webhook secret configured" }, { status: 401 });
  }

  // 2. Read raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get("x-gusto-signature") || "";

  // 3. Validate HMAC-SHA256
  const secret = decrypt(conn.webhookSecret);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 4. Parse and handle event
  const event = JSON.parse(body);
  const eventType = event.event_type || event.type || "";

  // Create feed notification for relevant events
  if (eventType.includes("payroll") || eventType.includes("time_off") || eventType.includes("employee")) {
    const message = getEventMessage(eventType, event);
    if (message) {
      const admin = await db.employee.findFirst({
        where: { user: { role: "SUPER_ADMIN" } },
      });
      if (admin) {
        await db.feedPost.create({
          data: {
            type: "ANNOUNCEMENT",
            content: message,
            authorId: admin.id,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function getEventMessage(eventType: string, _event: Record<string, unknown>): string | null {
  if (eventType.includes("payroll.processed")) {
    return "Payroll has been processed via Gusto.";
  }
  if (eventType.includes("time_off_request.approved")) {
    return "A time off request has been approved in Gusto.";
  }
  if (eventType.includes("employee.created")) {
    return "A new employee has been added in Gusto.";
  }
  return null;
}
