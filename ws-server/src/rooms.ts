import type { WebSocket } from "ws";

const rooms = new Map<string, Set<WebSocket>>();
const socketUsers = new Map<WebSocket, string>();
const userSockets = new Map<string, Set<WebSocket>>();

export function registerSocket(ws: WebSocket, userId: string) {
  socketUsers.set(ws, userId);
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);
}

export function unregisterSocket(ws: WebSocket) {
  const userId = socketUsers.get(ws);
  if (userId) {
    userSockets.get(userId)?.delete(ws);
    if (userSockets.get(userId)?.size === 0) {
      userSockets.delete(userId);
    }
  }
  socketUsers.delete(ws);

  for (const [, sockets] of rooms) {
    sockets.delete(ws);
  }
}

export function joinRoom(ws: WebSocket, channelId: string) {
  if (!rooms.has(channelId)) {
    rooms.set(channelId, new Set());
  }
  rooms.get(channelId)!.add(ws);
}

export function leaveRoom(ws: WebSocket, channelId: string) {
  rooms.get(channelId)?.delete(ws);
}

export function broadcastToRoom(channelId: string, data: string, excludeSocket?: WebSocket) {
  const sockets = rooms.get(channelId);
  if (!sockets) return;

  for (const ws of sockets) {
    if (ws !== excludeSocket && ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

export function getUserId(ws: WebSocket): string | undefined {
  return socketUsers.get(ws);
}

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(userSockets.keys());
}
