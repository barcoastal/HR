"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export function EmailNotificationToggle({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const { toggleEmailNotifications } = await import(
        "@/lib/actions/calendar-sync"
      );
      await toggleEmailNotifications(userId, !isEnabled);
      setIsEnabled(!isEnabled);
    } catch (err) {
      console.error("Failed to toggle notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
          <Icon name="notifications" size={16} className="text-[var(--color-accent)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Email Notifications
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Receive emails for new feed posts and events
          </p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          isEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]",
          loading && "opacity-50"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            isEnabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
