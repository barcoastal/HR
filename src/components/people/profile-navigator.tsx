"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { backToListHref, profileHref } from "@/lib/people-list-order";
import type { ProfileNeighbor } from "@/lib/people-neighbors";

const linkClass = cn(
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium min-w-0",
  "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
);
const disabledClass = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] opacity-50";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** "Back to list", position and Previous / Next links for a profile opened from the People list. */
export function ProfileNavigator({
  employeeId,
  from,
  prev,
  next,
  position,
  total,
}: {
  employeeId: string;
  /** The People list's view query string, carried through every link. */
  from: string;
  prev: ProfileNeighbor | null;
  next: ProfileNeighbor | null;
  position: number | null;
  total: number | null;
}) {
  const router = useRouter();
  const prevHref = prev ? profileHref(prev.id, from) : null;
  const nextHref = next ? profileHref(next.id, from) : null;

  // Alt+← / Alt+→ step through the list, unless the user is typing somewhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTyping(e.target)) return;
      const href = e.key === "ArrowLeft" ? prevHref : e.key === "ArrowRight" ? nextHref : null;
      if (!href) return;
      e.preventDefault();
      router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref, router]);

  return (
    <nav aria-label="Browse people" className="mb-4 flex flex-wrap items-center gap-2">
      <Link href={backToListHref(from, employeeId)} className={cn(linkClass, "-ml-3")}>
        <Icon name="list" size={16} /> Back to list
      </Link>
      <div className="ml-auto flex items-center gap-1 min-w-0">
        {prevHref ? (
          <Link href={prevHref} className={linkClass} title={`${prev!.name} (Alt+←)`} aria-label={`Previous: ${prev!.name}`}>
            <Icon name="arrow_back" size={16} /> Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            <Icon name="arrow_back" size={16} /> Previous
          </span>
        )}
        {position !== null && total !== null && (
          <span className="px-2 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
            {position} of {total}
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} className={linkClass} title={`${next!.name} (Alt+→)`} aria-label={`Next: ${next!.name}`}>
            <span className="truncate max-w-[14rem]">
              Next<span className="hidden sm:inline">: {next!.name}</span>
            </span>
            <Icon name="arrow_forward" size={16} />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Next <Icon name="arrow_forward" size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}
