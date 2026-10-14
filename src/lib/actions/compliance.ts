"use server";

import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/utils";
import { summarizeI9Coverage, type I9Row } from "@/lib/compliance";

/**
 * Everyone who should have an I-9 on file (not offboarded, not archived),
 * with the I-9 documents filed for them. Super Admin only.
 */
export async function listI9Overview(): Promise<{ rows: I9Row[]; missing: number; total: number }> {
  await requireSuperAdmin();
  const employees = await db.employee.findMany({
    where: { archivedAt: null, status: { not: "OFFBOARDED" } },
    select: {
      id: true,
      firstName: true,
      preferredName: true,
      lastName: true,
      jobTitle: true,
      status: true,
      startDate: true,
      documents: {
        where: { category: "I9" },
        select: { id: true, name: true, url: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const rows: I9Row[] = employees.map((e) => ({
    employeeId: e.id,
    name: displayName(e),
    jobTitle: e.jobTitle,
    status: e.status,
    startDate: e.startDate.toISOString(),
    documents: e.documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })),
  }));
  return { rows, ...summarizeI9Coverage(rows) };
}
