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
      // Check if another user already has this employee linked
      let employeeId = employee?.id || null;
      if (employeeId) {
        const existingLink = await db.user.findFirst({ where: { employeeId } });
        if (existingLink) {
          // Unlink the old user so we can link to the new credential user
          await db.user.update({ where: { id: existingLink.id }, data: { employeeId: null } });
        }
      }
      user = await db.user.create({
        data: {
          email: username,
          passwordHash: hash,
          role: "EMPLOYEE",
          employeeId,
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
