"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getMessages, sendMessage } from "@/lib/actions/chat-messages";
import { useChatContext } from "./chat-provider";
import type { MessagePayload } from "@/lib/chat/ws-types";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface Props {
  parentMessage: MessagePayload;
  channelId: string;
  channelType: "channel" | "dm";
  onClose: () => void;
}

export function ThreadPanel({ parentMessage, channelId, channelType, onClose }: Props) {
  const [replies, setReplies] = useState<MessagePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    async function loadReplies() {
      // For now, we don't have a dedicated thread endpoint, so we'll use a placeholder
      // Thread replies would be messages with parentId === parentMessage.id
      setLoading(false);
    }
    loadReplies();
  }, [parentMessage.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    // Optimistic reply
    const tempReply: MessagePayload = {
      id: `temp-${Date.now()}`,
      channelId: channelType === "channel" ? channelId : null,
      dmThreadId: channelType === "dm" ? channelId : null,
      parentId: parentMessage.id,
      authorId: session?.user?.employeeId || "self",
      content: text,
      contentPlain: text,
      createdAt: new Date().toISOString(),
      author: {
        id: session?.user?.employeeId || "self",
        firstName: session?.user?.name?.split(" ")[0] || "You",
        lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
        profilePhoto: session?.user?.profilePhoto || null,
      },
    };
    setReplies((prev) => [...prev, tempReply]);

    try {
      // TODO: add parentId support to sendMessage
      await sendMessage({
        channelId,
        content: text,
        contentPlain: text,
        type: channelType,
      });
    } catch (error) {
      console.error("Failed to send thread reply:", error);
    }
    setSending(false);
  }, [input, sending, channelId, channelType, parentMessage.id, session]);

  return (
    <div className="w-full md:w-[400px] border-l border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Thread</h3>
          <p className="text-[11px] text-gray-500">{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <span className="material-symbols-rounded text-[20px]">close</span>
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex gap-2">
          {parentMessage.author.profilePhoto ? (
            <img src={parentMessage.author.profilePhoto} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
              {getInitials(parentMessage.author.firstName, parentMessage.author.lastName)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-sm text-gray-900">{parentMessage.author.firstName} {parentMessage.author.lastName}</span>
              <span className="text-[10px] text-gray-400">{formatTime(parentMessage.createdAt)}</span>
            </div>
            <div
              className="text-sm text-gray-800 mt-0.5 [&>p]:my-0"
              dangerouslySetInnerHTML={{ __html: parentMessage.content }}
            />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && <p className="text-xs text-gray-400 text-center py-4">Loading replies...</p>}
        {!loading && replies.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No replies yet. Start the thread!</p>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2 py-2">
            {reply.author.profilePhoto ? (
              <img src={reply.author.profilePhoto} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0 mt-0.5" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-[9px] font-semibold shrink-0 mt-0.5">
                {getInitials(reply.author.firstName, reply.author.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-xs text-gray-900">{reply.author.firstName} {reply.author.lastName}</span>
                <span className="text-[10px] text-gray-400">{formatTime(reply.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-800 mt-0.5">{reply.contentPlain}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
        <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoSendToChannel}
            onChange={(e) => setAlsoSendToChannel(e.target.checked)}
            className="rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED] w-3.5 h-3.5"
          />
          <span className="text-[11px] text-gray-500">Also send to #{channelType === "channel" ? "channel" : "conversation"}</span>
        </label>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#7C3AED] min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-[#007a5a] text-white rounded-lg text-xs font-medium hover:bg-[#006b4f] disabled:opacity-50"
          >
            <span className="material-symbols-rounded text-[16px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
