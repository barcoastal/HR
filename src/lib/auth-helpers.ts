import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

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
