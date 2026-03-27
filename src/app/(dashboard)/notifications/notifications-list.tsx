"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getNotifications, markAsRead, markAllAsRead } from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "stage_changes", label: "Stage Changes" },
  { key: "signing", label: "Offers & Signing" },
  { key: "onboarding", label: "Hiring & Onboarding" },
  { key: "interviews", label: "Interviews" },
  { key: "feed", label: "Feed" },
];

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

export function NotificationsList() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load(type?: string, offset?: number) {
    setLoading(true);
    const result = await getNotifications({ limit: 20, offset: offset || 0, type: type || undefined });
    if (offset) {
      setNotifications((prev) => [...prev, ...result.notifications]);
    } else {
      setNotifications(result.notifications);
    }
    setTotal(result.total);
    setLoading(false);
  }

  useEffect(() => {
    load(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick(n: NotificationItem) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Notifications" />
        <button
          onClick={handleMarkAllRead}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10")}
        >
          Mark all read
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              filter === f.key
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={cn("rounded-2xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="progress_activity" className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-12">
            {filter ? "No notifications matching this filter" : "No notifications"}
          </p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-5 py-4 flex items-start gap-3",
                "hover:bg-[var(--color-surface-hover)] transition-colors",
                "border-b border-[var(--color-border)]/50 last:border-0"
              )}
            >
              <span className={cn(
                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                n.read ? "bg-transparent" : "bg-[var(--color-accent)]"
              )} />
              <div className="flex-1">
                <p className={cn(
                  "text-sm",
                  n.read ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                )}>
                  {n.message}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {notifications.length < total && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => load(filter, notifications.length)}
            disabled={loading}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10", "disabled:opacity-50")}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
