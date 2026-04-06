import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Public endpoint — returns published open positions
export async function GET() {
  const positions = await db.position.findMany({
    where: { status: "OPEN", published: true },
    include: { department: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    positions.map((p) => ({
      id: p.id,
      title: p.title,
      department: p.department?.name || null,
      description: p.description,
      requirements: p.requirements,
      salary: p.salary,
      location: p.location,
      type: p.type,
      createdAt: p.createdAt,
    }))
  );
}
