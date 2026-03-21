import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import jwt from "jsonwebtoken";

const WS_JWT_SECRET = process.env.WS_JWT_SECRET || "dev-ws-secret";

export async function POST() {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = jwt.sign(
    {
      userId: session.user.employeeId,
      email: session.user.email,
    },
    WS_JWT_SECRET,
    { expiresIn: "5m" }
  );

  return NextResponse.json({ token });
}
