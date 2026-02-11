// Prisma 7 requires a driver adapter for direct database connections.
// Install @prisma/adapter-pg and pg when ready to connect to the database.
// For now, this is a placeholder that will be configured when the DB is set up.

import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Will be initialized when database adapter is configured
export const db = globalForPrisma.prisma as unknown as PrismaClient;
