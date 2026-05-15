"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function cleanupDemoData() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only a SUPER_ADMIN can run demo cleanup");
  }

  // Find all demo employees (non-coastaldebt, non-pending.local emails)
  const demoEmployees = await db.employee.findMany({
    where: {
      NOT: { email: { endsWith: "@coastaldebt.com" } },
      email: { not: { endsWith: "@pending.local" } },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  const demoIds = demoEmployees.map((e) => e.id);

  if (demoIds.length > 0) {
    await db.employee.updateMany({ where: { managerId: { in: demoIds } }, data: { managerId: null } });
    await db.employee.updateMany({ where: { buddyId: { in: demoIds } }, data: { buddyId: null } });
    await db.department.updateMany({ where: { headId: { in: demoIds } }, data: { headId: null } });

    for (const emp of demoEmployees) {
      await db.user.deleteMany({ where: { employeeId: emp.id } });
      await db.employee.delete({ where: { id: emp.id } });
    }
  }

  // Remove empty departments
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

    if (dept.teams.length > 0) {
      await db.team.deleteMany({ where: { departmentId: dept.id } });
    }
    await db.department.delete({ where: { id: dept.id } });
    deletedDepts.push(dept.name);
  }

  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/org/departments");
  revalidatePath("/settings");

  return {
    deletedEmployees: demoEmployees.map((e) => `${e.firstName} ${e.lastName} (${e.email})`),
    deletedDepartments: deletedDepts,
  };
}
