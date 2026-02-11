"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/people", label: "People", icon: Users },
  { href: "/org", label: "Organization", icon: Building2 },
  { href: "/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/offboarding", label: "Offboarding", icon: UserMinus },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "glass fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col",
        "border-r border-[var(--color-border)]",
        "md:flex"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)]">
          <Users className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-[var(--color-text-primary)]">
          PeopleHub
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                "transition-colors duration-200",
                active
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="border-t border-[var(--color-border)] px-3 py-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
          <span className="ml-5">Toggle theme</span>
        </button>
      </div>
    </aside>
  );
}
