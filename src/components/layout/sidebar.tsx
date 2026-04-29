"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession, signOut } from "next-auth/react";
import { Icon } from "@/components/ui/icon";
import { cn, getInitials } from "@/lib/utils";
import {
  canAccessSettings,
  canAccessRecruitment,
  canAccessAnalytics,
  canManageOnboarding,
  canManageOffboarding,
  canManageEmployees,
  getRoleLevel,
} from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

const isManagerOrAbove = (r: UserRole) => getRoleLevel(r) >= 2;

const allNavLinks = [
  { href: "/", label: "Feed", icon: "newspaper", access: () => true },
  { href: "/alerts", label: "Alerts", icon: "warning", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" },
  { href: "/people", label: "People", icon: "group", access: () => true },
  { href: "/pre-onboarding", label: "Pre-Onboarding", icon: "assignment_turned_in", access: (r: UserRole) => canManageOnboarding(r) },
  { href: "/onboarding", label: "Onboarding", icon: "person_add", access: (r: UserRole) => canManageOnboarding(r) },
  { href: "/offboarding", label: "Offboarding", icon: "person_remove", access: (r: UserRole) => canManageOffboarding(r) },
  { href: "/reviews", label: "Reviews", icon: "assignment_turned_in", access: (r: UserRole) => isManagerOrAbove(r) },
  { href: "/one-on-ones", label: "1:1 Reviews", icon: "forum", access: () => true },
  { href: "/calendar", label: "Calendar", icon: "calendar_month", access: () => true },
  { href: "/clubs", label: "Clubs", icon: "groups", access: () => true },
  { href: "/voice", label: "Your Voice", icon: "campaign", access: () => true },
  { href: "/documents", label: "Documents", icon: "draw", access: () => true },
  { href: "/sign-queue", label: "Sign Queue", icon: "verified", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" },
  { href: "/my-documents", label: "My Documents", icon: "folder", access: () => true },
  { href: "/cv", label: "Recruitment", icon: "work", access: (r: UserRole) => canAccessRecruitment(r) },
  { href: "/analytics", label: "Analytics", icon: "bar_chart", access: (r: UserRole) => canAccessAnalytics(r) },
  { href: "/my-profile", label: "My Profile", icon: "account_circle", access: () => true },
  { href: "/settings", label: "Settings", icon: "settings", access: (r: UserRole) => canAccessSettings(r) },
];

export function Sidebar({ logoUrl, companyName }: { logoUrl?: string | null; companyName?: string }) {
  const pathname = usePathname();

  const { data: session } = useSession();

  const role = (session?.user?.role || "EMPLOYEE") as UserRole;
  const navLinks = allNavLinks.filter((l) => l.access(role));

  const userInitials = session?.user?.name
    ? getInitials(session.user.name.split(" ")[0], session.user.name.split(" ")[1] || "")
    : "??";

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "bg-[var(--color-surface-container-low)] fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col",
        "border-r border-[var(--color-border)]/60",
        "md:flex"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName || "Logo"} className="h-10 w-auto max-w-[180px] object-contain" />
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-none">
              <Icon name="group" size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--color-on-surface)] font-semibold">
              {companyName || "Coastal HR"}
            </span>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navLinks.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200",
                active
                  ? "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[var(--color-primary)]" />
              )}
              <Icon name={icon} size={20} fill={active} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--color-border)]/60 px-3 py-4 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-3 px-3 py-2">
            {session.user.profilePhoto ? (
              <img src={session.user.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">
                {userInitials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {session.user.role}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-red-500/10 hover:text-red-400"
          )}
        >
          <Icon name="logout" size={20} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
