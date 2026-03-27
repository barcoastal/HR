"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getNotifications, markAsRead, markAllAsRead } from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationDropdown({
  onClose,
  onCountChange,
}: {
  onClose: () => void;
  onCountChange: (count: number | ((prev: number) => number)) => void;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { notifications, unreadCount } = await getNotifications({ limit: 10 });
      setNotifications(notifications);
      onCountChange(unreadCount);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick(n: NotificationItem) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      onCountChange((prev: number) => Math.max(0, prev - 1));
    }
    if (n.link) {
      router.push(n.link);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    onCountChange(0);
  }

  return (
    <div className={cn(
      "absolute right-0 top-12 z-50 w-80 rounded-2xl shadow-xl",
      "bg-[var(--color-surface)] border border-[var(--color-border)]",
      "overflow-hidden"
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</span>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="progress_activity" className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-4 py-3 flex items-start gap-3",
                "hover:bg-[var(--color-surface-hover)] transition-colors",
                "border-b border-[var(--color-border)]/50 last:border-0"
              )}
            >
              <span className={cn(
                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                n.read ? "bg-transparent" : "bg-[var(--color-accent)]"
              )} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm leading-snug",
                  n.read ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                )}>
                  {n.message}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)]">
        <button
          onClick={() => { router.push("/notifications"); onClose(); }}
          className="w-full text-center py-2.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
