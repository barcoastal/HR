"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getThreadReplies, sendMessage } from "@/lib/actions/chat-messages";
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
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const loadReplies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getThreadReplies(parentMessage.id);
      setReplies(data.map((r: any) => ({
        id: r.id,
        content: r.content,
        contentPlain: r.contentPlain,
        authorId: r.authorId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        author: r.author,
      })));
    } catch (err) {
      console.error("Failed to load thread replies:", err);
    }
    setLoading(false);
  }, [parentMessage.id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    // Optimistic reply
    setReplies((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      content: text,
      contentPlain: text,
      authorId: session?.user?.employeeId || "self",
      createdAt: new Date().toISOString(),
      author: {
        id: session?.user?.employeeId || "self",
        firstName: session?.user?.name?.split(" ")[0] || "You",
        lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
        profilePhoto: (session?.user as any)?.profilePhoto || null,
      },
    }]);

    try {
      await sendMessage({
        channelId,
        content: text,
        contentPlain: text,
        type: channelType,
        parentId: parentMessage.id,
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
          <p className="text-[11px] text-gray-500">
            {parentMessage.author.firstName} {parentMessage.author.lastName} · {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
          <span className="material-symbols-rounded text-[20px]">close</span>
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex gap-3">
          {parentMessage.author.profilePhoto ? (
            <img src={parentMessage.author.profilePhoto} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {getInitials(parentMessage.author.firstName, parentMessage.author.lastName)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm text-gray-900">{parentMessage.author.firstName} {parentMessage.author.lastName}</span>
              <span className="text-[10px] text-gray-400">{formatTime(parentMessage.createdAt)}</span>
            </div>
            <div
              className="text-sm text-gray-800 mt-0.5 [&>p]:my-0 [&_a]:text-[#1264a3]"
              dangerouslySetInnerHTML={{ __html: parentMessage.content }}
            />
          </div>
        </div>
      </div>

      {/* Replies divider */}
      {replies.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-400 flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-rounded text-gray-300 animate-spin text-[20px]">progress_activity</span>
          </div>
        )}
        {!loading && replies.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No replies yet. Start the thread!</p>
        )}
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-2.5 py-2">
            {reply.author?.profilePhoto ? (
              <img src={reply.author.profilePhoto} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0 mt-0.5" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-[9px] font-semibold shrink-0 mt-0.5">
                {getInitials(reply.author?.firstName || "?", reply.author?.lastName || "")}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-[13px] text-gray-900">{reply.author?.firstName} {reply.author?.lastName}</span>
                <span className="text-[10px] text-gray-400">{formatTime(reply.createdAt)}</span>
              </div>
              <div
                className="text-[13px] text-gray-800 mt-0.5 [&>p]:my-0"
                dangerouslySetInnerHTML={{ __html: reply.content }}
              />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-[#007a5a] text-white rounded-lg hover:bg-[#006b4f] disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-rounded text-[16px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
