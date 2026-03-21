"use client";

import { usePathname } from "next/navigation";

import { useSession } from "next-auth/react";
import { Icon } from "@/components/ui/icon";
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

  const { data: session } = useSession();

  const userInitials = session?.user?.name
    ? getInitials(session.user.name.split(" ")[0], session.user.name.split(" ")[1] || "")
    : "??";

  return (
    <header
      className={cn(
        "glass sticky top-0 z-40 flex h-16 items-center justify-between",
        "shadow-[var(--shadow-glass)] px-4 md:px-6"
      )}
    >
      <div className="flex items-center">
        <span className="text-base font-bold text-[var(--color-on-surface)] md:hidden">
          Coastal HR
        </span>
        <h1 className="hidden text-lg font-semibold text-[var(--color-text-primary)] md:block">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              "bg-[var(--color-surface-container-lowest)] h-10 w-80 rounded-xl border border-[var(--color-border)]/60",
              "pl-9 pr-4 text-sm text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "transition-all duration-200",
              "focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            )}
          />
        </div>

        <button
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl",
            "text-[var(--color-text-muted)] transition-colors duration-200",
            "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Icon name="notifications" size={18} />
          <motion.span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </button>

        {session?.user?.profilePhoto ? (
          <img src={session.user.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
        ) : (
          <button
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-[var(--color-primary)]",
              "text-xs font-semibold text-white transition-opacity duration-200 hover:opacity-90"
            )}
          >
            {userInitials}
          </button>
        )}
      </div>
    </header>
  );
}
