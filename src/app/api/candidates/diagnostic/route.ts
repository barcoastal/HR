import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const total = await db.candidate.count();

  const bySource = await db.candidate.groupBy({
    by: ["source"],
    _count: true,
    orderBy: { _count: { source: "desc" } },
  });

  const jobingSample = await db.candidate.findMany({
    where: {
      OR: [
        { source: { contains: "jobing" } },
        { source: { contains: "pro.jobing" } },
      ],
    },
    select: { id: true, email: true, source: true, firstName: true, lastName: true, createdAt: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ total, bySource, jobingSample });
}
