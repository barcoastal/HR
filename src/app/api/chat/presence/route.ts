import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all chat members with their presence
  const members = await db.chatMember.findMany({
    select: {
      employeeId: true,
      presence: true,
    },
  });

  const presenceMap: Record<string, string> = {};
  for (const m of members) {
    presenceMap[m.employeeId] = m.presence;
  }

  return NextResponse.json(presenceMap);
}

export async function POST(req: Request) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee" }, { status: 400 });

  const { status } = await req.json();
  if (!["ONLINE", "AWAY", "DND", "OFFLINE"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db.chatMember.updateMany({
    where: { employeeId },
    data: { presence: status },
  });

  return NextResponse.json({ ok: true });
}
