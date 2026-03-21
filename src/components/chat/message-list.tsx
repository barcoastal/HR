"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { MessageItem } from "./message-item";

export function MessageList() {
  const { activeChannelId, messages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelMessages = activeChannelId ? messages.get(activeChannelId) || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  if (channelMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-4">
        {channelMessages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
