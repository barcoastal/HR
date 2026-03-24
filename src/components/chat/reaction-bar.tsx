"use client";

import { toggleReaction } from "@/lib/actions/chat-reactions";

interface ReactionGroup {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface Props {
  messageId: string;
  reactions: ReactionGroup[];
  onReactionToggle?: (emoji: string) => void;
}

export function ReactionBar({ messageId, reactions, onReactionToggle }: Props) {
  if (reactions.length === 0) return null;

  const handleToggle = async (emoji: string) => {
    // Optimistic update first
    onReactionToggle?.(emoji);
    // Then persist to server
    await toggleReaction(messageId, emoji);
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all hover:scale-105 ${
            r.hasReacted
              ? "bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#7C3AED]"
              : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
