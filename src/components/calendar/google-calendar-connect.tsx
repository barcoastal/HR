"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { disconnectGoogleCalendar } from "@/lib/actions/calendar-sync";
import { useRouter } from "next/navigation";

export function GoogleCalendarConnect({
  connected,
  userId,
}: {
  connected: boolean;
  userId: string;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Your synced events will remain in Google Calendar.")) return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar(userId);
      router.refresh();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setDisconnecting(false);
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Icon name="check_circle" size={16} />
          <span>Google Calendar connected</span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-sm text-red-500 hover:text-red-600 underline"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/platforms/google_calendar/authorize?mode=personal"
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
        "bg-[var(--color-accent)] text-white",
        "hover:bg-[var(--color-accent-hover)] transition-colors"
      )}
    >
      <Icon name="calendar_month" size={16} />
      Connect Google Calendar
    </a>
  );
}
