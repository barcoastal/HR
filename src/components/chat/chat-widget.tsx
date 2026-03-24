"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOrCreateWorkspace, getWorkspaceMembers } from "@/lib/actions/chat-workspace";
import { getChannels, createChannel } from "@/lib/actions/chat-channels";
import { getDmThreads, getOrCreateDmThread } from "@/lib/actions/chat-dms";
import { getMessages, sendMessage } from "@/lib/actions/chat-messages";
import { useSession } from "next-auth/react";
import { useUnread } from "@/lib/chat/use-unread";
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
  const { data: session } = useSession();
  const myId = session?.user?.employeeId;
  const { totalUnread } = useUnread();
  const [workspaceIdState, setWorkspaceIdState] = useState<string | null>(null);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<any[]>([]);
  const [channelName, setChannelName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (channels.length > 0) return;
    setLoading(true);
    try {
      const workspace = await getOrCreateWorkspace();
      if (!workspace) return;
      setWorkspaceIdState(workspace.id);
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

  const openNewDm = async () => {
    setShowNewDm(true);
    setShowNewChannel(false);
    setSearchQuery("");
    setSelectedPeople([]);
    if (allMembers.length === 0 && workspaceIdState) {
      const m = await getWorkspaceMembers(workspaceIdState) as any[];
      setAllMembers(m);
    }
  };

  const togglePerson = (person: any) => {
    setSelectedPeople((prev) =>
      prev.some((p) => p.id === person.id)
        ? prev.filter((p) => p.id !== person.id)
        : [...prev, person]
    );
  };

  const startDm = async () => {
    if (!workspaceIdState || selectedPeople.length === 0) return;
    setCreating(true);
    const dm = await getOrCreateDmThread(workspaceIdState, selectedPeople.map((p) => p.id)) as any;
    const members = dm.members?.map((m: any) => m.employee) || [];
    const otherMembers = myId ? members.filter((m: any) => m.id !== myId) : members;
    const displayMembers = otherMembers.length > 0 ? otherMembers : members;
    const name = displayMembers.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ");
    openMiniChat({ id: dm.id, name, type: "dm", profilePhoto: displayMembers[0]?.profilePhoto });
    setShowNewDm(false);
    setSelectedPeople([]);
    setCreating(false);
    // Refresh DM list
    const freshDms = await getDmThreads(workspaceIdState);
    setDms(freshDms as any[]);
  };

  const handleCreateChannel = async () => {
    if (!workspaceIdState || !channelName.trim()) return;
    setCreating(true);
    const channel = await createChannel({
      workspaceId: workspaceIdState,
      name: channelName.trim(),
    });
    setChannels((prev) => [...prev, channel]);
    openMiniChat({ id: channel.id, name: channel.name, type: "channel" });
    setShowNewChannel(false);
    setChannelName("");
    setCreating(false);
  };

  const filteredMembers = searchQuery
    ? allMembers.filter((m: any) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allMembers;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => { setOpen(!open); if (!open) loadData(); }}
        className={cn(
          "fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full items-center justify-center shadow-2xl transition-all hidden md:flex",
          "ring-4 ring-white",
          open ? "bg-gray-700 hover:bg-gray-800" : "bg-[#7C3AED] hover:bg-[#6D28D9]"
        )}
      >
        <span className="material-symbols-rounded text-white text-[24px]">
          {open ? "close" : "chat"}
        </span>
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 ring-2 ring-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Right-side panel */}
      {open && (
        <div className="fixed right-6 bottom-24 z-[60] w-80 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden hidden md:flex">
          {/* Header */}
          <div className="bg-[#1A1D21] px-3 py-2.5 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Calatrava Connect</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={openNewDm}
                title="New message"
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-rounded text-[18px]">edit_square</span>
              </button>
              <button
                onClick={() => { setShowNewChannel(true); setShowNewDm(false); setChannelName(""); }}
                title="New channel"
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-rounded text-[18px]">add_circle</span>
              </button>
              <Link
                href="/chat"
                className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                Open →
              </Link>
            </div>
          </div>

          {/* New DM picker */}
          {showNewDm && (
            <div className="border-b border-gray-200">
              <div className="px-3 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">New Message</p>
                <button onClick={() => setShowNewDm(false)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-rounded text-[16px]">close</span>
                </button>
              </div>
              {selectedPeople.length > 0 && (
                <div className="px-3 pb-1 flex flex-wrap gap-1">
                  {selectedPeople.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] px-2 py-0.5 rounded-full">
                      {p.firstName}
                      <button onClick={() => togglePerson(p)} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="px-3 pb-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people..."
                  autoFocus
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div className="max-h-36 overflow-y-auto px-2 pb-2">
                {filteredMembers.map((m: any) => {
                  const isSelected = selectedPeople.some((p) => p.id === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => togglePerson(m)}
                      className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs", isSelected ? "bg-[#7C3AED]/10" : "hover:bg-gray-50")}
                    >
                      {m.profilePhoto ? (
                        <img src={m.profilePhoto} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center text-white text-[8px] font-semibold shrink-0">
                          {getInitials(m.firstName, m.lastName)}
                        </div>
                      )}
                      <span className="text-gray-800">{m.firstName} {m.lastName}</span>
                      {isSelected && <span className="ml-auto text-[#7C3AED]">✓</span>}
                    </button>
                  );
                })}
              </div>
              {selectedPeople.length > 0 && (
                <div className="px-3 pb-2">
                  <button
                    onClick={startDm}
                    disabled={creating}
                    className="w-full bg-[#7C3AED] text-white text-xs font-medium py-1.5 rounded-lg hover:bg-[#6D28D9] disabled:opacity-50"
                  >
                    {creating ? "Creating..." : selectedPeople.length === 1 ? "Message" : `Create Group (${selectedPeople.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* New Channel */}
          {showNewChannel && (
            <div className="border-b border-gray-200 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">New Channel</p>
                <button onClick={() => setShowNewChannel(false)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-rounded text-[16px]">close</span>
                </button>
              </div>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="channel-name"
                autoFocus
                className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-[#7C3AED]"
              />
              <button
                onClick={handleCreateChannel}
                disabled={!channelName.trim() || creating}
                className="w-full bg-[#7C3AED] text-white text-xs font-medium py-1.5 rounded-lg hover:bg-[#6D28D9] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Channel"}
              </button>
            </div>
          )}

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
                      const allMembers = dm.members?.map((m: any) => m.employee) || [];
                      const otherMembers = myId ? allMembers.filter((m: any) => m.id !== myId) : allMembers;
                      const displayMembers = otherMembers.length > 0 ? otherMembers : allMembers;
                      const name = displayMembers.map((m: any) => `${m.firstName} ${m.lastName}`).join(", ");
                      const firstMember = displayMembers[0];
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
      <div className="fixed bottom-0 right-24 z-[55] flex items-end gap-2 hidden md:flex">
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
