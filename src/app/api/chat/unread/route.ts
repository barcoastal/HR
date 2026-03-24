import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.employeeId;
  if (!employeeId) return NextResponse.json({ totalUnread: 0, channels: {} });

  try {
    // Get all channel memberships with lastReadAt
    const memberships = await db.channelMember.findMany({
      where: { employeeId },
      select: { channelId: true, lastReadAt: true },
    });

    const channels: Record<string, number> = {};
    let totalUnread = 0;

    for (const m of memberships) {
      const count = await db.message.count({
        where: {
          channelId: m.channelId,
          isDeleted: false,
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          authorId: { not: employeeId },
        },
      });
      if (count > 0) {
        channels[m.channelId] = count;
        totalUnread += count;
      }
    }

    // Also check DM unreads
    const dmMemberships = await db.dmMember.findMany({
      where: { employeeId },
      select: { dmThreadId: true, lastReadAt: true },
    });

    for (const m of dmMemberships) {
      const count = await db.message.count({
        where: {
          dmThreadId: m.dmThreadId,
          isDeleted: false,
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          authorId: { not: employeeId },
        },
      });
      if (count > 0) {
        channels[m.dmThreadId] = count;
        totalUnread += count;
      }
    }

    return NextResponse.json({ totalUnread, channels });
  } catch {
    return NextResponse.json({ totalUnread: 0, channels: {} });
  }
}
