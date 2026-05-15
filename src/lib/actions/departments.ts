"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

async function assertCanManageOrg() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to manage departments");
  }
  return session;
}

export async function getDepartments() {
  await requireAuth();
  return db.department.findMany({
    include: {
      head: true,
      teams: true,
      employees: { where: { status: { not: "OFFBOARDED" } } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getDepartmentById(id: string) {
  await requireAuth();
  return db.department.findUnique({
    where: { id },
    include: {
      head: true,
      teams: true,
      employees: { include: { team: true } },
    },
  });
}

export async function createDepartment(data: {
  name: string;
  description?: string;
  headId?: string;
}) {
  await assertCanManageOrg();
  const dept = await db.department.create({ data });
  revalidatePath("/org");
  revalidatePath("/org/departments");
  return dept;
}

export async function updateDepartment(
  id: string,
  data: { name?: string; description?: string; headId?: string | null }
) {
  await assertCanManageOrg();
  const dept = await db.department.update({ where: { id }, data });
  revalidatePath("/org");
  revalidatePath("/org/departments");
  return dept;
}

export async function deleteDepartment(id: string) {
  await assertCanManageOrg();
  // Unassign employees from this department before deleting
  await db.employee.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  await db.department.delete({ where: { id } });
  revalidatePath("/org");
  revalidatePath("/org/departments");
  revalidatePath("/people");
}
