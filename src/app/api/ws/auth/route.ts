import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import jwt from "jsonwebtoken";

const WS_JWT_SECRET = process.env.WS_JWT_SECRET;
if (!WS_JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("[ws/auth] WS_JWT_SECRET is not set in production!");
}

export async function POST() {
  const secret = WS_JWT_SECRET || (process.env.NODE_ENV !== "production" ? "dev-ws-secret" : null);
  if (!secret) {
    return NextResponse.json({ error: "WebSocket auth not configured" }, { status: 500 });
  }

  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = jwt.sign(
    {
      userId: session.user.employeeId,
      email: session.user.email,
    },
    secret,
    { expiresIn: "5m" }
  );

  return NextResponse.json({ token });
}
