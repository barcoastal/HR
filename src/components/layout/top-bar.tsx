"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Bell, Search, Sun, Moon } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { motion } from "framer-motion";

const routeTitles: Record<string, string> = {
  "/": "Feed",
  "/people": "People",
  "/org": "Organization",
  "/org/departments": "Departments",
  "/onboarding": "Onboarding",
  "/offboarding": "Offboarding",
  "/reviews": "Reviews",
  "/settings": "Settings",
  "/cv": "Recruitment",
  "/analytics": "Analytics",
  "/calendar": "Calendar",
  "/time-off": "Time Off",
  "/clubs": "Clubs",
  "/voice": "Your Voice",
  "/my-profile": "My Profile",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route) && route !== "/") return title;
  }
  return "Coastal HR";
}

export function TopBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const userInitials = session?.user?.name
    ? getInitials(session.user.name.split(" ")[0], session.user.name.split(" ")[1] || "")
    : "??";

  return (
    <header
      className={cn(
        "glass sticky top-0 z-40 flex h-16 items-center justify-between",
        "border-b border-[var(--color-border)]/60 px-4 md:px-6"
      )}
    >
      <div className="flex items-center">
        <span className="text-base font-bold text-gradient md:hidden">
          Coastal HR
        </span>
        <h1 className="hidden text-lg font-semibold text-[var(--color-text-primary)] md:block">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              "glass h-10 w-80 rounded-xl border border-[var(--color-border)]/60",
              "pl-9 pr-4 text-sm text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "transition-all duration-200",
              "focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-light)]"
            )}
          />
        </div>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
          aria-label="Toggle theme"
        >
          <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
        </button>

        <button
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          <motion.span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </button>

        <button
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-gradient-to-br from-[var(--color-accent)] to-purple-600",
            "text-xs font-semibold text-white transition-opacity duration-200 hover:opacity-90"
          )}
        >
          {userInitials}
        </button>
      </div>
    </header>
  );
}
