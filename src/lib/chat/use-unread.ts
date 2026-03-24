"use client";

import { useState, useEffect, useCallback } from "react";

interface UnreadState {
  totalUnread: number;
  channels: Record<string, number>;
}

export function useUnread() {
  const [unread, setUnread] = useState<UnreadState>({ totalUnread: 0, channels: {} });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread");
      if (res.ok) {
        const data = await res.json();
        setUnread(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { ...unread, refresh };
}
