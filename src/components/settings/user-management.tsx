"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { inviteUser, updateUserRole, deleteUser, setUserPassword } from "@/lib/actions/users";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";
import { Icon } from "@/components/ui/icon";

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-500/15 text-amber-400",
  ADMIN: "bg-red-500/15 text-red-400",
  HR: "bg-purple-500/15 text-purple-400",
  MANAGER: "bg-blue-500/15 text-blue-400",
  EMPLOYEE: "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
};
const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-teal-500"];

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  colorIdx: number;
};

export function SettingsUserManagement({ users }: { users: UserItem[] }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [pwUser, setPwUser] = useState<UserItem | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const router = useRouter();

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setPwValue(out);
  }

  async function handleSetPassword() {
    if (!pwUser || !pwValue) return;
    setPwSaving(true);
    setPwError("");
    setPwSuccess("");
    const r = await setUserPassword(pwUser.id, pwValue);
    setPwSaving(false);
    if (!r.success) {
      setPwError(r.error || "Failed");
      return;
    }
    setPwSuccess(`Password set. Username: ${pwUser.email}`);
  }

  function closePwDialog() {
    setPwUser(null);
    setPwValue("");
    setPwError("");
    setPwSuccess("");
  }

  async function handleInvite() {
    if (!email) return;
    setLoading(true);
    await inviteUser({ email, role });
    setEmail("");
    setRole("EMPLOYEE");
    setLoading(false);
    setInviteOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await deleteUser(id);
    router.refresh();
  }

  async function handleRoleChange(id: string, newRole: UserRole) {
    await updateUserRole(id, newRole);
    router.refresh();
  }

  return (
    <>
      <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Icon name="shield" size={20} className="text-[var(--color-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">User Management</h2>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)] transition-colors")}
          >
            <Icon name="add" size={12} />Invite User
          </button>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">User</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Email</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Role</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[user.colorIdx])}>{user.initials}</div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-[var(--color-text-muted)]">{user.email}</td>
                  <td className="px-3 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className={cn("px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer", roleColors[user.role])}
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="HR">HR</option>
                      <option value="MANAGER">Manager</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPwUser(user)}
                        title="Set password"
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent)] transition-colors"
                      >
                        <Icon name="key" size={12} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors">
                        <Icon name="delete" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden space-y-3">
          {users.map((user) => (
            <div key={user.id} className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[user.colorIdx])}>{user.initials}</div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{user.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
                  </div>
                </div>
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", roleColors[user.role])}>{user.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={!!pwUser} onClose={closePwDialog} title="Set password">
        {pwUser && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--color-text-primary)]">{pwUser.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{pwUser.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">New password</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="At least 8 characters"
                  className={cn("flex-1 px-3 py-2 rounded-lg text-sm font-mono", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")}
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
                >
                  Generate
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Username will be the user's email: <span className="font-mono">{pwUser.email}</span>
              </p>
            </div>
            {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            {pwSuccess && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                {pwSuccess}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closePwDialog} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                Close
              </button>
              <button
                onClick={handleSetPassword}
                disabled={!pwValue || pwSaving}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
              >
                {pwSaving ? "Saving..." : "Save password"}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@coastaldebt.com" className={cn("w-full px-3 py-2 rounded-lg text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")} />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">User will sign in with Google using this email.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={cn("w-full px-3 py-2 rounded-lg text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)]")}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setInviteOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button onClick={handleInvite} disabled={!email || loading} className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}>
              {loading ? "Inviting..." : "Invite"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
