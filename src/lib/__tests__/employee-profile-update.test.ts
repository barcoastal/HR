import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employee: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { saveEmployeeProfile } from "@/lib/employee-profile-update";

const actor = { id: "admin-user", role: "SUPER_ADMIN", employeeId: "admin-employee", email: "admin@example.com" };
const archived = {
  id: "archived-person", firstName: "Jane", lastName: "Employee", email: "jane@example.com",
  archivedAt: new Date("2026-01-01"), archivedReason: "Duplicate import", user: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (work) => work(mocks));
  mocks.employee.findUnique.mockResolvedValue({ id: "person", archivedAt: null });
  mocks.employee.findMany.mockResolvedValue([]);
  mocks.user.findUnique.mockResolvedValue({ id: "login", email: "jane@pending.local" });
  mocks.user.findFirst.mockResolvedValue(null);
});

describe("employee email updates", () => {
  it("normalizes the email and updates the person and linked login in one transaction", async () => {
    expect(await saveEmployeeProfile("person", { email: " Jane@Example.com " }, actor)).toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.employee.update).toHaveBeenCalledWith({ where: { id: "person" }, data: { email: "jane@example.com" } });
    expect(mocks.user.update).toHaveBeenCalledWith({ where: { id: "login" }, data: { email: "jane@example.com" } });
  });

  it("returns a reviewable archived conflict before writing anything", async () => {
    mocks.employee.findMany.mockResolvedValue([archived]);
    const result = await saveEmployeeProfile("person", { email: archived.email }, actor);
    expect(result).toMatchObject({ ok: false, archivedEmailConflict: { id: archived.id, email: archived.email } });
    expect(mocks.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ archivedAt: {} }) }));
    expect(mocks.employee.update).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
  });

  it("releases only the reviewed archived owner and retains its original email and archive reason", async () => {
    mocks.employee.findMany.mockResolvedValue([archived]);
    expect(await saveEmployeeProfile("person", { email: archived.email }, actor, archived.id)).toEqual({ ok: true });
    expect(mocks.employee.update).toHaveBeenNthCalledWith(1, {
      where: { id: archived.id },
      data: { email: "archived.archived-person@archive.invalid", archivedReason: "Duplicate import\nEmail released: jane@example.com reassigned to employee person." },
    });
    expect(mocks.employee.update).toHaveBeenNthCalledWith(2, { where: { id: "person" }, data: { email: archived.email } });
    expect(mocks.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: "employee.archived_email.released", actorUserId: actor.id,
      details: { previousEmail: archived.email, reassignedToEmployeeId: "person" },
    }) }));
  });

  it.each([
    { ...archived, archivedAt: null },
    { ...archived, user: { id: "existing-login" } },
  ])("never releases an active employee or an archive still linked to a login", async (owner) => {
    mocks.employee.findMany.mockResolvedValue([owner]);
    expect(await saveEmployeeProfile("person", { email: archived.email }, actor, archived.id)).toMatchObject({ ok: false });
    expect(mocks.employee.update).not.toHaveBeenCalled();
  });

  it("rejects a separate login conflict before changing either employee", async () => {
    mocks.employee.findMany.mockResolvedValue([archived]);
    mocks.user.findFirst.mockResolvedValue({ id: "other-login" });
    expect(await saveEmployeeProfile("person", { email: archived.email }, actor, archived.id)).toMatchObject({ ok: false, error: expect.stringContaining("login account") });
    expect(mocks.employee.update).not.toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("does not create a login for a person who has none", async () => {
    mocks.user.findUnique.mockResolvedValue(null);
    expect(await saveEmployeeProfile("person", { email: "jane@example.com" }, actor)).toEqual({ ok: true });
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("repairs a linked login mismatch even if the submitted person email is unchanged", async () => {
    expect(await saveEmployeeProfile("person", { email: "jane@example.com" }, actor)).toEqual({ ok: true });
    expect(mocks.user.update).toHaveBeenCalled();
  });

  it("lets a login failure abort the transaction, including the archived release", async () => {
    mocks.employee.findMany.mockResolvedValue([archived]);
    const failure = { code: "P2002" };
    mocks.user.update.mockRejectedValue(failure);
    let rollback = false;
    mocks.transaction.mockImplementation(async (work) => {
      try { return await work(mocks); } catch (error) { rollback = true; throw error; }
    });
    expect(await saveEmployeeProfile("person", { email: archived.email }, actor, archived.id)).toMatchObject({ ok: false, error: expect.stringContaining("already in use") });
    expect(rollback).toBe(true);
    expect(mocks.auditLog.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "employee.updated" }) }));
  });

  it.each([undefined, { ...actor, role: "EMPLOYEE", employeeId: "someone-else" }])("checks the actor before database access", async (user) => {
    expect(await saveEmployeeProfile("person", { email: "jane@example.com" }, user)).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps self edits but restricts archived release to super admins", async () => {
    const self = { ...actor, role: "EMPLOYEE", employeeId: "person" };
    expect(await saveEmployeeProfile("person", { phone: "5551234567" }, self)).toEqual({ ok: true });
    expect(await saveEmployeeProfile("person", { email: archived.email }, self, archived.id)).toMatchObject({ ok: false });
  });

  it.each([{ email: "" }, { email: "invalid" }, { startDate: "bad date" }, { status: "ACTIVE" }, { user: { create: {} } }])("rejects invalid or unsupported form fields", async (data) => {
    expect(await saveEmployeeProfile("person", data, actor)).toMatchObject({ ok: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows clearing the optional birthday", async () => {
    expect(await saveEmployeeProfile("person", { birthday: null }, actor)).toEqual({ ok: true });
    expect(mocks.employee.update).toHaveBeenCalledWith({ where: { id: "person" }, data: { birthday: null } });
  });

  it("requires a fresh review if the archive changes before confirmation", async () => {
    expect(await saveEmployeeProfile("person", { email: archived.email }, actor, archived.id)).toMatchObject({ ok: false });
    expect(mocks.employee.update).not.toHaveBeenCalled();
  });
});
