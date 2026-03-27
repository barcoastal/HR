"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUnreadCount } from "@/lib/actions/notifications";
import { NotificationDropdown } from "./notification-dropdown";
import { Icon } from "@/components/ui/icon";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const c = await getUnreadCount();
      setCount(c);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(() => {
      if (!document.hidden) fetchCount();
    }, 30000);
    const handleVisibility = () => {
      if (!document.hidden) fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl",
          "text-[var(--color-text-muted)] transition-colors duration-200",
          "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <Icon name="notifications" size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          onClose={() => setOpen(false)}
          onCountChange={setCount}
        />
      )}
    </div>
  );
}
