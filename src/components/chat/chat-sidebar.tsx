"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels, createChannel } from "@/lib/actions/chat-channels";
import { getDmThreads, getOrCreateDmThread } from "@/lib/actions/chat-dms";
import { getWorkspaceMembers } from "@/lib/actions/chat-workspace";
import { useChatStore } from "@/lib/chat/use-chat-store";
import Link from "next/link";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export function ChatSidebar() {
  const params = useParams();
  const router = useRouter();
  const activeChannelId = params.channelId as string | undefined;
  const { channels, setChannels, setWorkspace, workspaceId, dmThreads, setDmThreads } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<any[]>([]);
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [channelPrivate, setChannelPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function init() {
      const workspace = await getOrCreateWorkspace();
      if (!workspace) return;
      setWorkspace(workspace.id, workspace.name);

      const channelList = await getChannels(workspace.id) as any[];
      setChannels(
        channelList.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          topic: c.topic,
          isPrivate: c.isPrivate,
          isDefault: c.isDefault,
          memberCount: c._count?.members ?? 0,
          isStarred: c.members?.[0]?.isStarred ?? false,
          isMuted: c.members?.[0]?.isMuted ?? false,
          unreadCount: 0,
        }))
      );

      const dms = await getDmThreads(workspace.id) as any[];
      setDmThreads(
        dms.map((dm: any) => ({
          id: dm.id,
          isGroup: dm.isGroup,
          members: dm.members.map((m: any) => m.employee),
          lastMessage: dm.messages?.[0]
            ? {
                content: dm.messages[0].contentPlain,
                createdAt: new Date(dm.messages[0].createdAt).toISOString(),
                authorId: dm.messages[0].authorId,
              }
            : undefined,
        }))
      );

      setLoading(false);
    }
    init();
  }, []);

  const loadMembers = async () => {
    if (!workspaceId || members.length > 0) return;
    const m = await getWorkspaceMembers(workspaceId) as any[];
    setMembers(m);
  };

  const openNewDm = async () => {
    setShowNewDm(true);
    setSelectedPeople([]);
    setSearchQuery("");
    await loadMembers();
  };

  const openNewChannel = () => {
    setShowNewChannel(true);
    setChannelName("");
    setChannelDesc("");
    setChannelPrivate(false);
  };

  const togglePerson = (person: any) => {
    const exists = selectedPeople.some((p) => p.id === person.id);
    if (exists) {
      setSelectedPeople(selectedPeople.filter((p) => p.id !== person.id));
    } else {
      setSelectedPeople([...selectedPeople, person]);
    }
  };

  const startDmWithSelected = async () => {
    if (!workspaceId || selectedPeople.length === 0) return;
    setCreating(true);
    const participantIds = selectedPeople.map((p) => p.id);
    const dm = await getOrCreateDmThread(workspaceId, participantIds) as any;
    const exists = dmThreads.some((d) => d.id === dm.id);
    if (!exists) {
      setDmThreads([
        ...dmThreads,
        {
          id: dm.id,
          isGroup: dm.isGroup,
          members: dm.members.map((m: any) => m.employee),
        },
      ]);
    }
    setShowNewDm(false);
    setSelectedPeople([]);
    setCreating(false);
    router.push(`/chat/${dm.id}?type=dm`);
  };

  const handleCreateChannel = async () => {
    if (!workspaceId || !channelName.trim()) return;
    setCreating(true);
    const channel = await createChannel({
      workspaceId,
      name: channelName.trim(),
      description: channelDesc.trim() || undefined,
      isPrivate: channelPrivate,
    });
    setChannels([
      ...channels,
      {
        id: channel.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        topic: channel.topic,
        isPrivate: channel.isPrivate,
        isDefault: false,
        memberCount: 1,
        isStarred: false,
        isMuted: false,
        unreadCount: 0,
      },
    ]);
    setShowNewChannel(false);
    setCreating(false);
    router.push(`/chat/${channel.id}`);
  };

  const filteredMembers = searchQuery
    ? members.filter((m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members;

  const starred = channels.filter((c) => c.isStarred);
  const regular = channels.filter((c) => !c.isStarred);

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-full overflow-y-auto relative"
      style={{ backgroundColor: "#1A1D21", color: "#D1D2D3" }}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <Link href="/" className="text-xs px-2 py-1 rounded hover:bg-white/10 text-gray-400 transition-colors">
          &larr; HR
        </Link>
        <h1 className="text-white font-bold text-base">HT Platform</h1>
        <div className="w-10" />
      </div>

      <nav className="px-2 py-3 space-y-0.5 text-sm flex-1 overflow-y-auto">
        {starred.length > 0 && (
          <>
            <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium">Starred</p>
            {starred.map((c) => (
              <ChannelLink key={c.id} channel={c} isActive={c.id === activeChannelId} />
            ))}
          </>
        )}

        <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium flex items-center justify-between">
          <span>Channels</span>
          <button onClick={openNewChannel} className="text-gray-400 hover:text-white transition-colors">+</button>
        </p>
        {loading ? (
          <div className="px-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          regular.map((c) => (
            <ChannelLink key={c.id} channel={c} isActive={c.id === activeChannelId} />
          ))
        )}

        <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium flex items-center justify-between">
          <span>Direct Messages</span>
          <button onClick={openNewDm} className="text-gray-400 hover:text-white transition-colors">+</button>
        </p>
        {dmThreads.map((dm) => (
          <DmLink key={dm.id} dm={dm} isActive={dm.id === activeChannelId} />
        ))}
      </nav>

      {/* New DM modal — multi-select */}
      {showNewDm && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-16" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-[#222529] rounded-xl w-80 max-h-[70vh] flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">New Message</h3>
              <button onClick={() => { setShowNewDm(false); setSearchQuery(""); setSelectedPeople([]); }} className="text-gray-400 hover:text-white transition-colors">
                <span className="material-symbols-rounded text-[18px]">close</span>
              </button>
            </div>

            {/* Selected people chips */}
            {selectedPeople.length > 0 && (
              <div className="px-3 pt-2 flex flex-wrap gap-1">
                {selectedPeople.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 bg-[#7C3AED]/20 text-[#c4b5fd] text-xs px-2 py-1 rounded-full">
                    {p.firstName}
                    <button onClick={() => togglePerson(p)} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="p-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#7C3AED]/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredMembers.map((m) => {
                const isSelected = selectedPeople.some((p) => p.id === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => togglePerson(m)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      isSelected ? "bg-[#7C3AED]/10" : "hover:bg-white/5"
                    }`}
                  >
                    {m.profilePhoto ? (
                      <img src={m.profilePhoto} alt={`${m.firstName} ${m.lastName}`} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {getInitials(m.firstName, m.lastName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{m.firstName} {m.lastName}</p>
                      {m.jobTitle && <p className="text-[11px] text-gray-500 truncate">{m.jobTitle}</p>}
                    </div>
                    {isSelected && (
                      <span className="text-[#7C3AED] text-sm">✓</span>
                    )}
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">No people found</p>
              )}
            </div>
            {selectedPeople.length > 0 && (
              <div className="p-3 border-t border-white/10">
                <button
                  onClick={startDmWithSelected}
                  disabled={creating}
                  className="w-full bg-[#7C3AED] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : selectedPeople.length === 1 ? "Message" : `Create Group (${selectedPeople.length} people)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Channel modal */}
      {showNewChannel && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-16" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-[#222529] rounded-xl w-80 flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Create Channel</h3>
              <button onClick={() => setShowNewChannel(false)} className="text-gray-400 hover:text-white transition-colors">
                <span className="material-symbols-rounded text-[18px]">close</span>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Channel name</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="e.g. marketing"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#7C3AED]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={channelDesc}
                  onChange={(e) => setChannelDesc(e.target.value)}
                  placeholder="What's this channel about?"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#7C3AED]/50"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channelPrivate}
                  onChange={(e) => setChannelPrivate(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span className="text-sm text-gray-300">Make private</span>
              </label>
              <button
                onClick={handleCreateChannel}
                disabled={!channelName.trim() || creating}
                className="w-full bg-[#7C3AED] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ChannelLink({
  channel,
  isActive,
}: {
  channel: { id: string; name: string; isPrivate: boolean; unreadCount: number };
  isActive: boolean;
}) {
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
        isActive ? "bg-[#7C3AED]/20 text-white" : "hover:bg-white/5 text-gray-400"
      } ${channel.unreadCount > 0 ? "font-semibold text-white" : ""}`}
    >
      <span className="text-xs opacity-60">{channel.isPrivate ? "🔒" : "#"}</span>
      <span className="truncate">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="ml-auto text-[10px] bg-[#EF4444] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {channel.unreadCount}
        </span>
      )}
    </Link>
  );
}

function DmLink({
  dm,
  isActive,
}: {
  dm: {
    id: string;
    members: Array<{ id: string; firstName: string; lastName: string; profilePhoto: string | null }>;
  };
  isActive: boolean;
}) {
  const displayName = dm.members.map((m) => m.firstName).join(", ");
  const firstMember = dm.members[0];

  return (
    <Link
      href={`/chat/${dm.id}?type=dm`}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
        isActive ? "bg-[#7C3AED]/20 text-white" : "hover:bg-white/5 text-gray-400"
      }`}
    >
      {firstMember?.profilePhoto ? (
        <img src={firstMember.profilePhoto} alt={displayName} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[8px] font-semibold flex-shrink-0">
          {firstMember ? getInitials(firstMember.firstName, firstMember.lastName) : "?"}
        </div>
      )}
      <span className="truncate text-sm">{displayName}</span>
    </Link>
  );
}
