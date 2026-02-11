"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const routeTitles: Record<string, string> = {
  "/": "Feed",
  "/people": "People",
  "/org": "Organization",
  "/org/departments": "Departments",
  "/onboarding": "Onboarding",
  "/offboarding": "Offboarding",
  "/reviews": "Reviews",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Check for dynamic routes (e.g. /people/123)
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route) && route !== "/") return title;
  }

  return "PeopleHub";
}

export function TopBar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header
      className={cn(
        "glass sticky top-0 z-40 flex h-16 items-center justify-between",
        "border-b border-[var(--color-border)] px-4 md:px-6"
      )}
    >
      {/* Left section */}
      <div className="flex items-center">
        {/* Mobile: app name */}
        <span className="text-base font-semibold text-[var(--color-text-primary)] md:hidden">
          PeopleHub
        </span>
        {/* Desktop: page title */}
        <h1 className="hidden text-lg font-semibold text-[var(--color-text-primary)] md:block">
          {title}
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search (desktop only) */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              "h-9 w-64 rounded-full border border-[var(--color-border)]",
              "bg-[var(--color-surface)] pl-9 pr-4 text-sm text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "transition-colors duration-200",
              "focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            )}
          />
        </div>

        {/* Notification bell */}
        <button
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {/* Red dot indicator */}
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User avatar */}
        <button
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)]",
            "text-xs font-semibold text-white transition-opacity duration-200 hover:opacity-90"
          )}
        >
          JD
        </button>
      </div>
    </header>
  );
}
