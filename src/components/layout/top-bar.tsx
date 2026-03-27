"use client";

import { useSession } from "next-auth/react";
import { Icon } from "@/components/ui/icon";
import { cn, getInitials } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";


export function TopBar() {
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
      <div className="flex items-center gap-2">
        <span className="text-base font-black tracking-wide text-[var(--color-on-surface)]">
          CALATRAVA
        </span>
        <span className="text-xs text-[var(--color-on-surface-variant)]">
          by Coastal Debt Resolve
        </span>
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

        <NotificationBell />

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
