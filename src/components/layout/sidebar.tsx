"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession, signOut } from "next-auth/react";
import {
  Newspaper,
  Users,
  Building2,
  UserPlus,
  UserMinus,
  ClipboardCheck,
  Settings,
  Sun,
  Moon,
  Briefcase,
  BarChart3,
  CalendarDays,
  LogOut,
  Palmtree,
  Users2,
  Megaphone,
  UserCircle,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import {
  canAccessSettings,
  canAccessRecruitment,
  canAccessAnalytics,
} from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

const allNavLinks = [
  { href: "/", label: "Feed", icon: Newspaper, access: () => true },
  { href: "/people", label: "People", icon: Users, access: () => true },
  { href: "/org", label: "Organization", icon: Building2, access: () => true },
  { href: "/onboarding", label: "Onboarding", icon: UserPlus, access: () => true },
  { href: "/offboarding", label: "Offboarding", icon: UserMinus, access: () => true },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, access: () => true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, access: () => true },
  { href: "/time-off", label: "Time Off", icon: Palmtree, access: () => true },
  { href: "/clubs", label: "Clubs", icon: Users2, access: () => true },
  { href: "/voice", label: "Your Voice", icon: Megaphone, access: () => true },
  { href: "/cv", label: "Recruitment", icon: Briefcase, access: (r: UserRole) => canAccessRecruitment(r) },
  { href: "/analytics", label: "Analytics", icon: BarChart3, access: (r: UserRole) => canAccessAnalytics(r) },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, access: () => true },
  { href: "/settings", label: "Settings", icon: Settings, access: (r: UserRole) => canAccessSettings(r) },
];

export function Sidebar({ logoUrl, companyName }: { logoUrl?: string | null; companyName?: string }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
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
        "glass fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col",
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 shadow-lg shadow-[var(--color-accent-glow)]">
              <Users className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gradient">
              {companyName || "Coastal HR"}
            </span>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200",
                active
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--color-accent)] to-purple-500" />
              )}
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Theme toggle */}
      <div className="border-t border-[var(--color-border)]/60 px-3 py-4 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-purple-600 text-xs font-semibold text-white">
              {userInitials}
            </div>
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
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <div className="relative h-5 w-5">
            <Sun className="absolute inset-0 h-5 w-5 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute inset-0 h-5 w-5 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
          </div>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-red-500/10 hover:text-red-400"
          )}
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
