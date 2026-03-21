"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels } from "@/lib/actions/chat-channels";
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
  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  const openNewDm = async () => {
    if (!workspaceId) return;
    setShowNewDm(true);
    if (members.length === 0) {
      const m = await getWorkspaceMembers(workspaceId) as any[];
      setMembers(m);
    }
  };

  const startDm = async (participantId: string) => {
    if (!workspaceId) return;
    setShowNewDm(false);
    const dm = await getOrCreateDmThread(workspaceId, [participantId]) as any;
    // Add to sidebar if not already there
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
    router.push(`/chat/${dm.id}?type=dm`);
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
      className="w-64 flex-shrink-0 flex flex-col h-full overflow-y-auto"
      style={{ backgroundColor: "#1A1D21", color: "#D1D2D3" }}
    >
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <Link
          href="/"
          className="text-xs px-2 py-1 rounded hover:bg-white/10 text-gray-400 transition-colors"
        >
          &larr; HR
        </Link>
        <h1 className="text-white font-bold text-base">HT Platform</h1>
        <div className="w-10" />
      </div>

      <nav className="px-2 py-3 space-y-0.5 text-sm flex-1 overflow-y-auto">
        {starred.length > 0 && (
          <>
            <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Starred
            </p>
            {starred.map((c) => (
              <ChannelLink key={c.id} channel={c} isActive={c.id === activeChannelId} />
            ))}
          </>
        )}

        <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium flex items-center justify-between">
          <span>Channels</span>
          <button className="text-gray-400 hover:text-white transition-colors">+</button>
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
          <button
            onClick={openNewDm}
            className="text-gray-400 hover:text-white transition-colors"
          >
            +
          </button>
        </p>
        {dmThreads.map((dm) => (
          <DmLink key={dm.id} dm={dm} isActive={dm.id === activeChannelId} />
        ))}
      </nav>

      {/* New DM modal */}
      {showNewDm && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-16" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-[#222529] rounded-xl w-80 max-h-[70vh] flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">New Message</h3>
              <button
                onClick={() => { setShowNewDm(false); setSearchQuery(""); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-rounded text-[18px]">close</span>
              </button>
            </div>
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
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => startDm(m.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  {m.profilePhoto ? (
                    <img
                      src={m.profilePhoto}
                      alt={`${m.firstName} ${m.lastName}`}
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {getInitials(m.firstName, m.lastName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{m.firstName} {m.lastName}</p>
                    {m.jobTitle && (
                      <p className="text-[11px] text-gray-500 truncate">{m.jobTitle}</p>
                    )}
                  </div>
                </button>
              ))}
              {filteredMembers.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">No people found</p>
              )}
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
        isActive
          ? "bg-[#7C3AED]/20 text-white"
          : "hover:bg-white/5 text-gray-400"
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
        <img
          src={firstMember.profilePhoto}
          alt={displayName}
          className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[8px] font-semibold flex-shrink-0">
          {firstMember ? getInitials(firstMember.firstName, firstMember.lastName) : "?"}
        </div>
      )}
      <span className="truncate text-sm">{displayName}</span>
    </Link>
  );
}
