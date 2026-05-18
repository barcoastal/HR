import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireApiAdmin } from "@/lib/auth-helpers";

// GET handler so you can trigger from browser: /api/cleanup-demo?token=coastal-cleanup-2026
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== "coastal-cleanup-2026") {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }
  return runCleanup();
}

// DELETE /api/cleanup-demo (admin auth required)
export async function DELETE() {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runCleanup();
}

async function runCleanup() {
  // Find all demo employees (non-coastaldebt emails)
  const demoEmployees = await db.employee.findMany({
    where: {
      NOT: { email: { endsWith: "@coastaldebt.com" } },
      email: { not: { endsWith: "@pending.local" } },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  // First, unlink manager/buddy references pointing to demo employees
  const demoIds = demoEmployees.map((e) => e.id);
  if (demoIds.length > 0) {
    await db.employee.updateMany({
      where: { managerId: { in: demoIds } },
      data: { managerId: null },
    });
    await db.employee.updateMany({
      where: { buddyId: { in: demoIds } },
      data: { buddyId: null },
    });
    // Unlink department heads
    await db.department.updateMany({
      where: { headId: { in: demoIds } },
      data: { headId: null },
    });
  }

  // Delete demo employees (cascade handles related records)
  for (const emp of demoEmployees) {
    await db.user.deleteMany({ where: { employeeId: emp.id } });
    await db.employee.delete({ where: { id: emp.id } });
  }

  // Remove empty departments (no employees, no teams with members)
  const allDepts = await db.department.findMany({
    include: {
      _count: { select: { employees: true } },
      teams: { include: { _count: { select: { employees: true } } } },
    },
  });

  const deletedDepts: string[] = [];
  for (const dept of allDepts) {
    if (dept._count.employees > 0) continue;
    const hasTeamMembers = dept.teams.some((t) => t._count.employees > 0);
    if (hasTeamMembers) continue;

    // Delete empty teams first
    if (dept.teams.length > 0) {
      await db.team.deleteMany({ where: { departmentId: dept.id } });
    }
    await db.department.delete({ where: { id: dept.id } });
    deletedDepts.push(dept.name);
  }

  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/org/departments");

  return NextResponse.json({
    deletedEmployees: demoEmployees.map((e) => `${e.firstName} ${e.lastName} (${e.email})`),
    deletedDepartments: deletedDepts,
  });
}
