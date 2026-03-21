"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientEvent, ServerEvent } from "./ws-types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

type EventHandler = (event: ServerEvent) => void;

export function useWebSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    // Get JWT token from auth endpoint
    let token: string;
    try {
      const res = await fetch("/api/ws/auth", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      token = data.token;
    } catch {
      // Schedule reconnect
      scheduleReconnect();
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent;
        onEvent(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    function scheduleReconnect() {
      const delay = Math.min(
        RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt.current),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttempt.current++;
      reconnectTimeout.current = setTimeout(connect, delay);
    }
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send, isConnected };
}
