"use client";

import { useState, useRef, useCallback } from "react";
import { sendMessage } from "@/lib/actions/chat-messages";
import { useChatStore } from "@/lib/chat/use-chat-store";
import type { MessagePayload } from "@/lib/chat/ws-types";

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  channelName: string;
}

export function MessageInput({ channelId, channelType, channelName }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addMessage } = useChatStore();

  const handleSubmit = useCallback(async () => {
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setContent("");

    const tempId = `temp-${Date.now()}`;
    const optimistic: MessagePayload = {
      id: tempId,
      channelId: channelType === "channel" ? channelId : null,
      dmThreadId: channelType === "dm" ? channelId : null,
      parentId: null,
      authorId: "self",
      content: text,
      contentPlain: text,
      createdAt: new Date().toISOString(),
      author: { id: "self", firstName: "You", lastName: "", profilePhoto: null },
    };
    addMessage(channelId, optimistic);

    try {
      await sendMessage({ channelId, content: text, type: channelType });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [content, sending, channelId, channelType, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED]/20 transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${channelType === "channel" ? "#" : ""}${channelName}`}
          rows={1}
          className="w-full px-4 py-3 text-sm resize-none outline-none bg-transparent"
          style={{ minHeight: "44px", maxHeight: "200px" }}
        />
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50">
          <div className="flex gap-1 text-gray-400" />
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || sending}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              content.trim()
                ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            <span className="material-symbols-rounded text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
