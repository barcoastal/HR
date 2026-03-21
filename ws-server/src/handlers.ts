import type { WebSocket } from "ws";
import { joinRoom, leaveRoom, broadcastToRoom, getUserId } from "./rooms";

export function handleClientMessage(ws: WebSocket, raw: string) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  switch (data.type) {
    case "subscribe":
      joinRoom(ws, data.channelId as string);
      break;

    case "unsubscribe":
      leaveRoom(ws, data.channelId as string);
      break;

    case "typing:start": {
      const userId = getUserId(ws);
      if (userId) {
        broadcastToRoom(
          data.channelId as string,
          JSON.stringify({
            type: "typing",
            channelId: data.channelId,
            userId,
            displayName: "",
          }),
          ws
        );
      }
      break;
    }

    case "typing:stop":
      break;

    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

export function handleBroadcastEvent(event: Record<string, unknown>) {
  const channelId = event.channelId as string;
  if (!channelId) return;

  broadcastToRoom(channelId, JSON.stringify(event));
}
