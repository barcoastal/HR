// ─── Client → Server events ───

export type ClientEvent =
  | { type: "subscribe"; channelId: string }
  | { type: "unsubscribe"; channelId: string }
  | { type: "typing:start"; channelId: string }
  | { type: "typing:stop"; channelId: string }
  | { type: "presence:update"; status: "online" | "away" | "dnd" }
  | { type: "ping" };

// ─── Server → Client events ───

export interface AttachmentPayload {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  thumbnailUrl: string | null;
}

export interface MessagePayload {
  id: string;
  channelId: string | null;
  dmThreadId: string | null;
  parentId: string | null;
  authorId: string;
  content: string;
  contentPlain: string;
  createdAt: string;
  attachments?: AttachmentPayload[];
  author: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
  };
}

export type ServerEvent =
  | { type: "message:new"; channelId: string; message: MessagePayload }
  | { type: "message:update"; channelId: string; messageId: string; content: string; contentPlain: string }
  | { type: "message:delete"; channelId: string; messageId: string }
  | { type: "typing"; channelId: string; userId: string; displayName: string }
  | { type: "presence:update"; userId: string; status: "online" | "away" | "dnd" | "offline" }
  | { type: "unread:update"; channelId: string; count: number }
  | { type: "force-disconnect"; reason: string }
  | { type: "pong" };

// ─── Internal: Next.js → WS Server HTTP events ───

export type BroadcastEvent =
  | { type: "message:new"; channelId: string; message: MessagePayload }
  | { type: "message:update"; channelId: string; messageId: string; content: string; contentPlain: string }
  | { type: "message:delete"; channelId: string; messageId: string };
