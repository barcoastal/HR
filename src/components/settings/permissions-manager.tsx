"use client";

import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { ALL_PERMISSIONS } from "@/lib/permissions-config";
import { updateRolePermissions } from "@/lib/actions/role-permissions";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const ROLES = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  HR: "HR",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-500/15 text-amber-400",
  ADMIN: "bg-red-500/15 text-red-400",
  HR: "bg-purple-500/15 text-purple-400",
  MANAGER: "bg-blue-500/15 text-blue-400",
  EMPLOYEE: "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
};

type Props = {
  permissions: Record<string, string[]>;
};

export function PermissionsManager({ permissions }: Props) {
  const [perms, setPerms] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    for (const role of ROLES) {
      map[role] = new Set(permissions[role] || []);
    }
    return map;
  });
  const [isPending, startTransition] = useTransition();
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const router = useRouter();

  function toggle(role: string, permission: string) {
    if (role === "SUPER_ADMIN") return; // can't change super admin
    setPerms((prev) => {
      const next = { ...prev };
      const set = new Set(prev[role]);
      if (set.has(permission)) {
        set.delete(permission);
      } else {
        set.add(permission);
      }
      next[role] = set;
      return next;
    });
  }

  function saveRole(role: string) {
    if (role === "SUPER_ADMIN") return;
    setSavingRole(role);
    const permMap: Record<string, boolean> = {};
    for (const p of ALL_PERMISSIONS) {
      permMap[p.key] = perms[role].has(p.key);
    }
    startTransition(async () => {
      await updateRolePermissions(role, permMap);
      setSavingRole(null);
      router.refresh();
    });
  }

  function toggleAll(role: string, grant: boolean) {
    if (role === "SUPER_ADMIN") return;
    setPerms((prev) => {
      const next = { ...prev };
      next[role] = grant ? new Set(ALL_PERMISSIONS.map((p) => p.key)) : new Set();
      return next;
    });
  }

  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-5">
        <Icon name="shield" size={20} className="text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Role Permissions</h2>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Control what each role can access. Super Admin always has full access.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider min-w-[200px]">
                Permission
              </th>
              {ROLES.map((role) => (
                <th key={role} className="px-3 py-2.5 text-center min-w-[100px]">
                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", roleColors[role])}>
                    {roleLabels[role]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm.key} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                <td className="px-3 py-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{perm.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{perm.description}</p>
                  </div>
                </td>
                {ROLES.map((role) => {
                  const granted = perms[role]?.has(perm.key);
                  const isSuperAdmin = role === "SUPER_ADMIN";
                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggle(role, perm.key)}
                        disabled={isSuperAdmin}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                          granted
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
                          isSuperAdmin
                            ? "cursor-not-allowed opacity-60"
                            : "hover:bg-[var(--color-surface-hover)] cursor-pointer"
                        )}
                      >
                        {granted ? <Icon name="check" size={16} /> : <Icon name="close" size={16} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--color-border)]">
              <td className="px-3 py-3">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Quick actions</p>
              </td>
              {ROLES.map((role) => (
                <td key={role} className="px-3 py-3 text-center">
                  {role === "SUPER_ADMIN" ? (
                    <span className="text-xs text-[var(--color-text-muted)]">Locked</span>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleAll(role, true)}
                          className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                        >
                          All
                        </button>
                        <button
                          onClick={() => toggleAll(role, false)}
                          className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                        >
                          None
                        </button>
                      </div>
                      <button
                        onClick={() => saveRole(role)}
                        disabled={isPending}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                          "disabled:opacity-50"
                        )}
                      >
                        {savingRole === role ? (
                          <Icon name="progress_activity" size={12} className="animate-material-spin" />
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
