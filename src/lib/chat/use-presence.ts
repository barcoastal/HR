"use client";

import { useState, useEffect, useCallback } from "react";

// Maps employeeId → presence status
type PresenceMap = Record<string, string>;

export function usePresence() {
  const [presence, setPresence] = useState<PresenceMap>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/presence");
      if (res.ok) {
        const data = await res.json();
        setPresence(data);
      }
    } catch {}
  }, []);

  // Set self as online on mount, offline on unmount
  useEffect(() => {
    fetch("/api/chat/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ONLINE" }),
    });

    refresh();
    const interval = setInterval(refresh, 60000); // Poll every minute

    // Set offline on page close
    const handleUnload = () => {
      navigator.sendBeacon?.(
        "/api/chat/presence",
        new Blob([JSON.stringify({ status: "OFFLINE" })], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      fetch("/api/chat/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OFFLINE" }),
      }).catch(() => {});
    };
  }, [refresh]);

  const getStatus = (employeeId: string): string => {
    return presence[employeeId] || "OFFLINE";
  };

  return { presence, getStatus, refresh };
}
