"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { MessageItem } from "./message-item";
import type { MessagePayload } from "@/lib/chat/ws-types";

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";

  const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString("en-US", options);
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isSameAuthorGroup(prev: MessagePayload, curr: MessagePayload): boolean {
  if (prev.authorId !== curr.authorId) return false;
  const diff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff < 5 * 60 * 1000; // Within 5 minutes
}

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
        {channelMessages.map((msg, i) => {
          const prev = i > 0 ? channelMessages[i - 1] : null;
          const showDateSeparator = !prev || !isSameDay(prev.createdAt, msg.createdAt);
          const isGrouped = prev && !showDateSeparator && isSameAuthorGroup(prev, msg);

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 px-5 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                    {formatDateSeparator(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
              <MessageItem message={msg} isGrouped={!!isGrouped} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
