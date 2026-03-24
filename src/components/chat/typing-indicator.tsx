"use client";

import { useChatStore } from "@/lib/chat/use-chat-store";
import { useSession } from "next-auth/react";

export function TypingIndicator({ channelId }: { channelId: string }) {
  const { typingUsers } = useChatStore();
  const { data: session } = useSession();
  const myId = session?.user?.employeeId;

  const typingSet = typingUsers.get(channelId);
  if (!typingSet || typingSet.size === 0) return null;

  // Filter out self
  const others = Array.from(typingSet).filter((id) => id !== myId);
  if (others.length === 0) return null;

  const text =
    others.length === 1
      ? "Someone is typing..."
      : others.length === 2
        ? "2 people are typing..."
        : `${others.length} people are typing...`;

  return (
    <div className="px-5 py-1.5 text-xs text-gray-500 flex items-center gap-2">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      {text}
    </div>
  );
}
