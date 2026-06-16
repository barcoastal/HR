import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    redirect("/login?error=unauthorized");
  }
  return session;
}

export async function requireManagerOrAdmin() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    redirect("/login?error=unauthorized");
  }
  return session;
}

/**
 * Returns the employeeId the current user must scope candidate queries to,
 * or null if they are unrestricted (admins, super-admins, HR — they see
 * every candidate).
 *
 * A user is "scoped" when:
 *   - they are not SUPER_ADMIN / ADMIN / HR (those roles see everything), AND
 *   - their employeeId appears in CompanySettings.recruiterIds.
 *
 * MANAGER / EMPLOYEE users who AREN'T in the recruiter list never reach the
 * recruitment pages (route guard requireManagerOrAdmin handles that), so
 * this function only needs to distinguish "full view" from "recruiter view".
 */
export async function getRecruiterScope(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const role = session.user.role;
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR") return null;
  const empId = session.user.employeeId;
  if (!empId) return null;
  try {
    const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
    if (!settings) return null;
    const ids: string[] = JSON.parse(settings.recruiterIds || "[]");
    return ids.includes(empId) ? empId : null;
  } catch {
    return null;
  }
}

/** For API routes — returns session or null (no redirect). */
export async function getApiSession() {
  return getServerSession(authOptions);
}

/** For API routes — returns 401 JSON if not authenticated. */
export async function requireApiAuth() {
  const session = await getApiSession();
  if (!session) {
    return null;
  }
  return session;
}

/** For API routes — returns 403 JSON if not admin/HR. */
export async function requireApiAdmin() {
  const session = await requireApiAuth();
  if (!session) return null;
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return null;
  }
  return session;
}
