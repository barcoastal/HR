"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UniversalSearch } from "@/components/layout/universal-search";

export function TopBar({ userDisplayName }: { userDisplayName?: string | null }) {
  const { data: session } = useSession();

  const shownName = userDisplayName || session?.user?.name;
  const userInitials = shownName
    ? getInitials(shownName.split(" ")[0], shownName.split(" ")[1] || "")
    : "??";

  return (
    <header
      className={cn(
        "glass sticky top-0 z-40 flex h-16 items-center gap-3",
        "shadow-[var(--shadow-glass)] px-3 md:px-6"
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-base font-black tracking-wide text-[var(--color-on-surface)]">
          CALATRAVA
        </span>
        <span className="hidden text-xs text-[var(--color-on-surface-variant)] xl:inline">
          by Coastal Debt Resolve
        </span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-0 sm:px-3">
        <UniversalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell />

        <Link
          href="/my-profile"
          aria-label="Open my profile"
          title="My profile"
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {session?.user?.profilePhoto ? (
            <img src={session.user.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "bg-[var(--color-primary)]",
                "text-xs font-semibold text-white transition-opacity duration-150 hover:opacity-90"
              )}
            >
              {userInitials}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
