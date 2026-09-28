import { db } from "@/lib/db";

type Actor = { role?: string | null } | undefined;

/** Record whether a former employee can be rehired, and why. */
export async function saveRehireEligibility(
  employeeId: string,
  decision: { eligible: boolean | null; notes?: string | null },
  actor: Actor
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!["SUPER_ADMIN", "ADMIN", "HR"].includes(actor?.role ?? "")) {
    return { ok: false, error: "Not authorized" };
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, status: true, firstName: true, lastName: true },
  });
  if (!employee) return { ok: false, error: "Employee not found" };
  if (employee.status !== "OFFBOARDED") {
    return { ok: false, error: "Rehire eligibility is set when someone is offboarded." };
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { rehireEligible: decision.eligible, rehireNotes: decision.notes?.trim() || null },
  });
  return { ok: true, name: `${employee.firstName} ${employee.lastName}` };
}
