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

  /**
   * Recipients who must never be notified: offboarded or archived employees, or anyone
   * whose login has been deactivated. Uses the un-extended client so archived rows are visible.
   */
  async function blockedRecipients(ids: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Set();
    const [employees, users] = await Promise.all([
      base.employee.findMany({
        where: { id: { in: unique }, OR: [{ status: "OFFBOARDED" }, { archivedAt: { not: null } }] },
        select: { id: true },
      }),
      base.user.findMany({ where: { employeeId: { in: unique }, deactivatedAt: { not: null } }, select: { employeeId: true } }),
    ]);
    return new Set([...employees.map((e) => e.id), ...users.flatMap((u) => (u.employeeId ? [u.employeeId] : []))]);
  }

  type NotificationData = { recipientId?: string; recipient?: { connect?: { id?: string } }; type?: string; message?: string; link?: string | null };

  return base.$extends({
    query: {
      notification: {
        // Every feature that writes an in-app notification passes through here, so a deactivated
        // person never receives one no matter which code path created it.
        async create({ args, query }) {
          const data = args.data as NotificationData;
          const recipientId = data.recipientId ?? data.recipient?.connect?.id;
          if (recipientId && (await blockedRecipients([recipientId])).size > 0) {
            return {
              id: "suppressed",
              recipientId,
              type: data.type ?? "SUPPRESSED",
              message: data.message ?? "",
              link: data.link ?? null,
              read: true,
              createdAt: new Date(),
            } as Awaited<ReturnType<typeof query>>;
          }
          return query(args);
        },
        async createMany({ args, query }) {
          const rows = (Array.isArray(args.data) ? args.data : [args.data]) as NotificationData[];
          const blocked = await blockedRecipients(rows.map((r) => r.recipientId ?? ""));
          if (blocked.size === 0) return query(args);
          const kept = rows.filter((r) => !r.recipientId || !blocked.has(r.recipientId));
          if (kept.length === 0) return { count: 0 } as Awaited<ReturnType<typeof query>>;
          return query({ ...args, data: kept as typeof args.data });
        },
      },
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
