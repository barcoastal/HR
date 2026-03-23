"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels } from "@/lib/actions/chat-channels";
import { getDmThreads } from "@/lib/actions/chat-dms";
import { getMessages, sendMessage } from "@/lib/actions/chat-messages";
import { cn } from "@/lib/utils";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

type MiniChat = {
  id: string;
  name: string;
  type: "channel" | "dm";
  profilePhoto?: string | null;
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [dms, setDms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [miniChats, setMiniChats] = useState<MiniChat[]>([]);

  const loadData = useCallback(async () => {
    if (channels.length > 0) return;
    setLoading(true);
    try {
      const workspace = await getOrCreateWorkspace();
      if (!workspace) return;
      const [ch, dm] = await Promise.all([
        getChannels(workspace.id),
        getDmThreads(workspace.id),
      ]);
      setChannels(ch as any[]);
      setDms(dm as any[]);
    } catch {}
    setLoading(false);
  }, [channels.length]);

  const openMiniChat = (chat: MiniChat) => {
    if (miniChats.some((c) => c.id === chat.id)) return;
    setMiniChats((prev) => [...prev.slice(-2), chat]); // Max 3 mini chats
    setOpen(false);
  };

  const closeMiniChat = (id: string) => {
    setMiniChats((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => { setOpen(!open); if (!open) loadData(); }}
        className={cn(
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hidden md:flex",
          open ? "bg-gray-700 hover:bg-gray-800" : "bg-[#7C3AED] hover:bg-[#6D28D9]"
        )}
      >
        <span className="material-symbols-rounded text-white text-[24px]">
          {open ? "close" : "chat"}
        </span>
      </button>

      {/* Right-side panel */}
      {open && (
        <div className="fixed right-6 bottom-24 z-40 w-80 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden hidden md:flex">
          {/* Header */}
          <div className="bg-[#1A1D21] px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">HT Chat</h3>
            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                Open full →
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Channels */}
                <div className="px-3 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">Channels</p>
                  {channels.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => openMiniChat({ id: c.id, name: c.name, type: "channel" })}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED] text-xs font-semibold shrink-0">
                        #
                      </span>
                      <span className="text-sm text-gray-800 truncate">{c.name}</span>
                    </button>
                  ))}
                </div>

                {/* DMs */}
                {dms.length > 0 && (
                  <div className="px-3 pt-2 pb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">Direct Messages</p>
                    {dms.map((dm: any) => {
                      const members = dm.members?.map((m: any) => m.employee) || [];
                      const name = members.map((m: any) => m.firstName).join(", ");
                      const firstMember = members[0];
                      return (
                        <button
                          key={dm.id}
                          onClick={() => openMiniChat({
                            id: dm.id,
                            name,
                            type: "dm",
                            profilePhoto: firstMember?.profilePhoto,
                          })}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          {firstMember?.profilePhoto ? (
                            <img src={firstMember.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
                              {firstMember ? getInitials(firstMember.firstName, firstMember.lastName) : "?"}
                            </div>
                          )}
                          <span className="text-sm text-gray-800 truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mini chat windows at bottom */}
      <div className="fixed bottom-0 right-24 z-30 flex items-end gap-2 hidden md:flex">
        {miniChats.map((chat) => (
          <MiniChatWindow key={chat.id} chat={chat} onClose={() => closeMiniChat(chat.id)} />
        ))}
      </div>
    </>
  );
}

function MiniChatWindow({ chat, onClose }: { chat: MiniChat; onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { messages: msgs } = await getMessages(chat.id, { type: chat.type, limit: 20 });
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          content: m.contentPlain || m.content,
          authorName: `${m.author.firstName} ${m.author.lastName}`,
          authorPhoto: m.author.profilePhoto,
          authorId: m.authorId,
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
        })));
      } catch {}
      setLoaded(true);
    }
    load();
  }, [chat.id, chat.type]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      content: text,
      authorName: "You",
      authorPhoto: null,
      authorId: "self",
      createdAt: new Date().toISOString(),
    }]);
    try {
      await sendMessage({ channelId: chat.id, content: text, contentPlain: text, type: chat.type });
    } catch {}
    setSending(false);
  }

  return (
    <div className={cn(
      "bg-white rounded-t-xl shadow-2xl border border-gray-200 border-b-0 flex flex-col transition-all",
      minimized ? "w-64 h-11" : "w-80 h-96"
    )}>
      {/* Header */}
      <div
        className="bg-[#1A1D21] px-3 py-2.5 flex items-center justify-between rounded-t-xl cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {chat.type === "channel" ? (
            <span className="text-white text-xs">#</span>
          ) : chat.profilePhoto ? (
            <img src={chat.profilePhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[8px] font-semibold">
              {chat.name[0]}
            </div>
          )}
          <span className="text-white text-sm font-medium truncate">{chat.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
            className="text-gray-400 hover:text-white p-0.5"
          >
            <span className="material-symbols-rounded text-[16px]">{minimized ? "open_in_full" : "minimize"}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-gray-400 hover:text-white p-0.5"
          >
            <span className="material-symbols-rounded text-[16px]">close</span>
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {!loaded && <div className="text-center text-xs text-gray-400 py-4">Loading...</div>}
            {loaded && messages.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-8">No messages yet</div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                {msg.authorPhoto ? (
                  <img src={msg.authorPhoto} alt="" className="w-6 h-6 rounded-md object-cover shrink-0 mt-0.5" />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center text-white text-[8px] font-semibold shrink-0 mt-0.5">
                    {msg.authorName[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-semibold text-gray-900">{msg.authorName}</span>
                    <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700 break-words">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-2 pb-2">
            <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#7C3AED]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`Message ${chat.type === "channel" ? "#" : ""}${chat.name}`}
                className="flex-1 px-3 py-2 text-xs outline-none min-w-0"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-2 text-[#007a5a] disabled:text-gray-300"
              >
                <span className="material-symbols-rounded text-[18px]">send</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
