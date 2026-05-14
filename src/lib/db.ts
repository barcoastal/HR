import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const pool = new Pool({ connectionString, max: 40 });
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({ adapter });

  // Hide archived employees from every read by default. Callers that need to
  // see archived rows (the archive page, restore/purge actions) pass an
  // explicit `archivedAt` filter, which we leave alone.
  type ArchivableWhere = { archivedAt?: unknown } & Record<string, unknown>;
  const ensureNotArchived = (args: { where?: ArchivableWhere }) => {
    if (!args.where || args.where.archivedAt === undefined) {
      args.where = { ...(args.where ?? {}), archivedAt: null };
    }
  };

  return base.$extends({
    query: {
      employee: {
        findMany({ args, query }) {
          ensureNotArchived(args);
          return query(args);
        },
        findFirst({ args, query }) {
          ensureNotArchived(args);
          return query(args);
        },
        findFirstOrThrow({ args, query }) {
          ensureNotArchived(args);
          return query(args);
        },
        count({ args, query }) {
          ensureNotArchived(args);
          return query(args);
        },
        aggregate({ args, query }) {
          ensureNotArchived(args);
          return query(args);
        },
      },
    },
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
