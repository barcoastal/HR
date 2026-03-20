"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getDepartments() {
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
  const dept = await db.department.create({ data });
  revalidatePath("/org");
  revalidatePath("/org/departments");
  return dept;
}

export async function updateDepartment(
  id: string,
  data: { name?: string; description?: string; headId?: string | null }
) {
  const dept = await db.department.update({ where: { id }, data });
  revalidatePath("/org");
  revalidatePath("/org/departments");
  return dept;
}

export async function deleteDepartment(id: string) {
  await db.department.delete({ where: { id } });
  revalidatePath("/org");
  revalidatePath("/org/departments");
}
