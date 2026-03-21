"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels } from "@/lib/actions/chat-channels";
import { getDmThreads } from "@/lib/actions/chat-dms";
import { useChatStore } from "@/lib/chat/use-chat-store";
import Link from "next/link";

export function ChatSidebar() {
  const params = useParams();
  const activeChannelId = params.channelId as string | undefined;
  const { channels, setChannels, setWorkspace, dmThreads, setDmThreads } = useChatStore();
  const [loading, setLoading] = useState(true);

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

      <nav className="px-2 py-3 space-y-0.5 text-sm">
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

        <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
          Direct Messages
        </p>
        {dmThreads.map((dm) => (
          <DmLink key={dm.id} dm={dm} isActive={dm.id === activeChannelId} />
        ))}
      </nav>
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

  return (
    <Link
      href={`/chat/${dm.id}?type=dm`}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
        isActive ? "bg-[#7C3AED]/20 text-white" : "hover:bg-white/5 text-gray-400"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-gray-600 flex-shrink-0" />
      <span className="truncate text-sm">{displayName}</span>
    </Link>
  );
}
