"use client";

import { useSession } from "next-auth/react";
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
