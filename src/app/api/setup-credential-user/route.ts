import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// One-time setup route — creates credential user for Eli
// DELETE THIS ROUTE AFTER FIRST USE for security
export async function GET() {
  try {
    const username = "Eli";
    const password = "shvufhiscs";

    const hash = await bcrypt.hash(password, 12);

    // Find Eli's employee record
    const employee = await db.employee.findFirst({
      where: {
        firstName: { equals: "Eli", mode: "insensitive" },
      },
    });

    // Create or update user with credential login
    let user = await db.user.findUnique({ where: { email: username } });
    if (user) {
      user = await db.user.update({
        where: { email: username },
        data: { passwordHash: hash },
      });
    } else {
      user = await db.user.create({
        data: {
          email: username,
          passwordHash: hash,
          role: "EMPLOYEE",
          employeeId: employee?.id || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      username,
      employeeLinked: !!employee,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : null,
    });
  } catch (error) {
    console.error("[setup-credential-user] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
