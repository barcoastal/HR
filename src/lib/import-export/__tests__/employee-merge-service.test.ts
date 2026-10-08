import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `mergeEmployees` talks to many Prisma delegates (one per employee foreign key). A Proxy hands
 * out a stub delegate for every model so the test only has to script the ones that matter.
 */
type Delegate = ReturnType<typeof makeDelegate>;
type Args = Record<string, unknown>;
const makeDelegate = () => ({
  updateMany: vi.fn(async (_args: Args) => ({ count: 0 })),
  findMany: vi.fn(async (_args?: Args): Promise<unknown[]> => []),
  findUnique: vi.fn(async (_args: Args): Promise<unknown> => null),
  update: vi.fn(async (_args: Args) => ({})),
  delete: vi.fn(async (_args: Args) => ({})),
  create: vi.fn(async (_args: Args) => ({})),
});
const mocks = vi.hoisted(() => {
  const delegates: Record<string, unknown> = {};
  return { delegates };
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, name: string) => (mocks.delegates[name] ??= makeDelegate()) }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/import-export/batch-service", () => ({ loadEmployeesLite: vi.fn(async () => []) }));
vi.mock("@/lib/import-export/employee-write", () => ({
  createOrgResolver: vi.fn(async () => ({})),
  // Pass text fields straight through; the real rules are covered by their own tests.
  employeeUpdateFromRowData: vi.fn(async (_current: unknown, data: Record<string, string>) => ({
    patch: Object.fromEntries(Object.entries(data).filter(([k]) => ["firstName", "lastName", "email", "phone"].includes(k))),
    notes: [],
  })),
}));

import { mergeEmployees } from "@/lib/import-export/employee-merge-service";
import { employeeUpdateFromRowData } from "@/lib/import-export/employee-write";

const d = (name: string) => (mocks.delegates[name] ??= makeDelegate()) as Delegate;

const OLD = { id: "old", firstName: "Dana", lastName: "Reyes", email: "dana.old@corp.com", status: "ACTIVE", departmentId: null, manager: null };
const NEW = { id: "new", firstName: "Dana", lastName: "Reyes", email: "dana@corp.com", status: "ACTIVE", departmentId: null, manager: null };

beforeEach(() => {
  for (const k of Object.keys(mocks.delegates)) delete mocks.delegates[k];
  vi.mocked(employeeUpdateFromRowData).mockClear();
  d("employee").findUnique.mockImplementation((async (args: { where: { id?: string; email?: string } }) => {
    if (args.where.id === OLD.id) return OLD;
    if (args.where.id === NEW.id) return NEW;
    return null;
  }) as never);
});

function groupLogins(logins: { id: string; employeeId: string; email: string }[]) {
  d("user").findMany.mockImplementation((async () => logins) as never);
}

describe("mergeEmployees logins and email", () => {
  it("keeps the duplicate's login when the Result email is its address: detaches and deactivates the primary's login first, then relinks", async () => {
    groupLogins([
      { id: "u-old", employeeId: "old", email: "dana.old@corp.com" },
      { id: "u-new", employeeId: "new", email: "dana@corp.com" },
    ]);
    const result = await mergeEmployees({ primaryId: "old", duplicateIds: ["new"], data: { email: "dana@corp.com", phone: "305" }, actorUserId: "admin" });

    const calls = d("user").update.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      { where: { id: "u-old" }, data: { employeeId: null, deactivatedAt: expect.any(Date) } },
      { where: { id: "u-new" }, data: { employeeId: "old" } },
    ]);
    expect(result.relinkedUser).toBe("dana@corp.com");
    expect(result.detachedUsers).toEqual(["dana.old@corp.com"]);
    expect(result.deleted).toEqual(["new"]);

    // The primary's email follows the kept login; the duplicate was deleted first so the address is free.
    const patch = d("employee").update.mock.calls[0][0] as { where: { id: string }; data: Record<string, unknown> };
    expect(patch.where).toEqual({ id: "old" });
    expect(patch.data.email).toBe("dana@corp.com");
    expect(patch.data.phone).toBe("305");
    expect(result.notes).toEqual([]);
    // The import-update rules never see the email, so their "it's the login" rule cannot block it.
    expect(vi.mocked(employeeUpdateFromRowData).mock.calls[0][1]).not.toHaveProperty("email");
  });

  it("keeps the primary's login and its address when the Result email is not a login", async () => {
    groupLogins([
      { id: "u-old", employeeId: "old", email: "dana.old@corp.com" },
      { id: "u-new", employeeId: "new", email: "dana@corp.com" },
    ]);
    const result = await mergeEmployees({ primaryId: "old", duplicateIds: ["new"], data: { email: "dana.personal@gmail.com" }, actorUserId: "admin" });

    expect(d("user").update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "u-new" }, data: { employeeId: null, deactivatedAt: expect.any(Date) } },
    ]);
    expect(result.relinkedUser).toBeNull();
    expect(result.detachedUsers).toEqual(["dana@corp.com"]);
    const patch = d("employee").update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(patch.data).not.toHaveProperty("email");
    expect(result.notes).toEqual(["Email kept as dana.old@corp.com — it's the login"]);
  });

  it("moves the only login to a primary without one and takes its address", async () => {
    groupLogins([{ id: "u-new", employeeId: "new", email: "dana@corp.com" }]);
    const result = await mergeEmployees({ primaryId: "old", duplicateIds: ["new"], data: { email: "dana@corp.com" }, actorUserId: "admin" });

    expect(d("user").update.mock.calls.map((c) => c[0])).toEqual([{ where: { id: "u-new" }, data: { employeeId: "old" } }]);
    expect(result.relinkedUser).toBe("dana@corp.com");
    expect(result.detachedUsers).toEqual([]);
    const patch = d("employee").update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(patch.data.email).toBe("dana@corp.com");
  });

  it("leaves the email to the import-update rules when nobody in the group has a login", async () => {
    groupLogins([]);
    await mergeEmployees({ primaryId: "old", duplicateIds: ["new"], data: { email: "dana@corp.com" }, actorUserId: "admin" });

    expect(d("user").update).not.toHaveBeenCalled();
    expect(vi.mocked(employeeUpdateFromRowData).mock.calls[0][1]).toMatchObject({ email: "dana@corp.com" });
  });

  it("keeps the old address when the kept login's email already belongs to someone outside the group", async () => {
    groupLogins([{ id: "u-new", employeeId: "new", email: "dana@corp.com" }]);
    d("employee").findUnique.mockImplementation((async (args: { where: { id?: string; email?: string } }) => {
      if (args.where.id === OLD.id) return OLD;
      if (args.where.id === NEW.id) return NEW;
      if (args.where.email === "dana@corp.com") return { id: "someone-else" };
      return null;
    }) as never);
    const result = await mergeEmployees({ primaryId: "old", duplicateIds: ["new"], data: { email: "dana@corp.com" }, actorUserId: "admin" });

    const patch = d("employee").update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(patch.data).not.toHaveProperty("email");
    expect(result.notes).toEqual(["Email kept — dana@corp.com is already used by someone else"]);
  });
});
