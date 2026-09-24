import { db } from "@/lib/db";

export type ArchivedEmailConflict = { id: string; name: string; email: string };
type Result = { ok: true } | { ok: false; error: string; archivedEmailConflict?: ArchivedEmailConflict };
type Actor = { id?: string; employeeId?: string | null; email?: string | null; role?: string };

const profileFields = new Set([
  "firstName", "middleName", "preferredName", "lastName", "email", "personalEmail",
  "phone", "jobTitle", "departmentId", "startDate", "birthday", "location", "hobbies",
  "bio", "dietaryRestrictions", "pronouns", "tShirtSize", "address", "city", "state",
  "zipCode", "country", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
]);

export async function saveEmployeeProfile(
  id: string,
  data: Record<string, unknown>,
  actor: Actor | undefined,
  archivedEmailOwnerId?: string,
): Promise<Result> {
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "HR"].includes(actor?.role ?? "");
  if (!actor?.id || (!isAdmin && actor.employeeId !== id)) {
    return { ok: false, error: "You do not have permission to edit this employee." };
  }
  if (archivedEmailOwnerId && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a super admin can release an archived email." };
  }

  const patch: Record<string, string | null | Date> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!profileFields.has(key) || (value !== null && typeof value !== "string")) {
      return { ok: false, error: "The employee form contains an invalid field." };
    }
    if (["firstName", "lastName", "email", "jobTitle"].includes(key) && !value?.trim()) {
      return { ok: false, error: "First name, last name, email and job title are required." };
    }
    if (key === "startDate" || key === "birthday") {
      if (!value) {
        if (key === "birthday") patch.birthday = null;
        continue;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return { ok: false, error: "Please enter a valid date." };
      patch[key] = date;
    } else if (key === "email" || key === "personalEmail") {
      const email = value?.trim().toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Please enter a valid email address." };
      }
      patch[key] = email;
    } else {
      patch[key] = value;
    }
  }

  try {
    return await db.$transaction(async (tx): Promise<Result> => {
      const current = await tx.employee.findUnique({ where: { id }, select: { id: true, archivedAt: true } });
      if (!current || current.archivedAt) return { ok: false, error: "This employee is no longer active in People." };

      const email = typeof patch.email === "string" ? patch.email : undefined;
      let archivedOwner: { id: string; email: string; archivedReason: string | null } | undefined;
      let linkedUser: { id: string; email: string } | null = null;
      if (email) {
        // Explicitly include archived rows: the normal employee query hides them, but
        // their unique email still prevents an update.
        const owners = await tx.employee.findMany({
          where: { id: { not: id }, email: { equals: email, mode: "insensitive" }, archivedAt: {} },
          select: { id: true, firstName: true, lastName: true, email: true, archivedAt: true, archivedReason: true, user: { select: { id: true } } },
        });
        // Both null and non-null archive dates must be considered.
        if (owners.length) {
          const owner = owners[0];
          if (owners.length !== 1 || !owner.archivedAt) {
            return { ok: false, error: "This email is already assigned to another employee. Use a different email or review the duplicate records." };
          }
          if (actor.role !== "SUPER_ADMIN" || owner.user) {
            return { ok: false, error: "This email belongs to an archived employee. Ask a super admin to review the archived record and its login." };
          }
          if (archivedEmailOwnerId !== owner.id) {
            return {
              ok: false,
              error: `This email belongs to the archived record “${owner.firstName} ${owner.lastName}”.`,
              archivedEmailConflict: { id: owner.id, name: `${owner.firstName} ${owner.lastName}`, email: owner.email },
            };
          }
          archivedOwner = owner;
        } else if (archivedEmailOwnerId) {
          return { ok: false, error: "The archived record changed. Save again to check the email." };
        }
        linkedUser = await tx.user.findUnique({ where: { employeeId: id }, select: { id: true, email: true } });
        const otherUser = await tx.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, ...(linkedUser ? { id: { not: linkedUser.id } } : {}) },
          select: { id: true },
        });
        if (otherUser) return { ok: false, error: "This email is already used by another login account. Ask a super admin to review that account." };
      }

      const auditActor = {
        actorUserId: actor.id, actorEmployeeId: actor.employeeId ?? null,
        actorEmail: actor.email ?? null, actorRole: actor.role ?? null,
      };
      if (archivedOwner) {
        // Keep all archived history and the exact former address. Do not restore,
        // merge, delete or relink any person or login.
        await tx.employee.update({
          where: { id: archivedOwner.id },
          data: {
            email: `archived.${archivedOwner.id}@archive.invalid`,
            archivedReason: [archivedOwner.archivedReason, `Email released: ${archivedOwner.email} reassigned to employee ${id}.`].filter(Boolean).join("\n"),
          },
        });
        await tx.auditLog.create({ data: {
          ...auditActor, action: "employee.archived_email.released", entityType: "employee", entityId: archivedOwner.id,
          details: { previousEmail: archivedOwner.email, reassignedToEmployeeId: id },
        } });
      }
      await tx.employee.update({ where: { id }, data: patch });
      if (email && linkedUser && linkedUser.email !== email) {
        await tx.user.update({ where: { id: linkedUser.id }, data: { email } });
      }
      await tx.auditLog.create({ data: {
        ...auditActor, action: "employee.updated", entityType: "employee", entityId: id,
        details: { fields: Object.keys(patch) },
      } });
      return { ok: true };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code === "P2002") return { ok: false, error: "This email is already in use. Refresh and review the employee and login records." };
    if (code === "P2034") return { ok: false, error: "This record changed while saving. Please try again." };
    console.error("[employee-profile] Save failed", { code: typeof code === "string" ? code : "unknown" });
    return { ok: false, error: "Unable to save changes. Please try again." };
  }
}
