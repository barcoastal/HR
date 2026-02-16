import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSession() {
  return getServerSession(authOptions);
}

// Auth temporarily disabled — return mock admin session if not logged in
const mockSession = {
  user: {
    id: "mock-admin",
    email: "admin",
    name: "Admin",
    role: "ADMIN" as const,
    employeeId: null,
  },
  expires: "2099-01-01T00:00:00.000Z",
};

export async function requireAuth() {
  const session = await getSession();
  return session || mockSession;
}

export async function requireAdmin() {
  const session = await requireAuth();
  return session;
}

export async function requireManagerOrAdmin() {
  const session = await requireAuth();
  return session;
}
