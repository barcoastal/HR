"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateDmThread } from "@/lib/actions/chat-dms";
import { addMembersToChannel } from "@/lib/actions/chat-channels";
import { getWorkspaceMembers } from "@/lib/actions/chat-workspace";
import { useChatStore } from "@/lib/chat/use-chat-store";

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
  jobTitle: string | null;
}

interface Props {
  name: string;
  topic?: string;
  memberCount: number;
  isPrivate: boolean;
  isDm: boolean;
  channelId?: string;
  members?: Member[];
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export function ChannelHeader({ name, topic, memberCount, isPrivate, isDm, channelId, members = [] }: Props) {
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const { workspaceId } = useChatStore();

  const handleMemberClick = async (memberId: string) => {
    if (!workspaceId) return;
    const dm = await getOrCreateDmThread(workspaceId, [memberId]) as any;
    router.push(`/chat/${dm.id}?type=dm`);
    setShowMembers(false);
  };

  const openAddMember = async () => {
    if (!workspaceId) return;
    setShowAddMember(true);
    setSearchQuery("");
    if (allMembers.length === 0) {
      const m = await getWorkspaceMembers(workspaceId) as any[];
      setAllMembers(m);
    }
  };

  const handleAddMember = async (employeeId: string) => {
    if (!channelId) return;
    setAdding(true);
    await addMembersToChannel(channelId, [employeeId]);
    setAdding(false);
    setShowAddMember(false);
    router.refresh();
  };

  // Filter out people already in the channel
  const currentMemberIds = new Set(members.map((m) => m.id));
  const availableMembers = allMembers.filter((m) => !currentMemberIds.has(m.id));
  const filteredAvailable = searchQuery
    ? availableMembers.filter((m: any) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableMembers;

  return (
    <>
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile back/menu button */}
          <a href="/chat" className="md:hidden text-gray-500 hover:text-gray-700 mr-1">
            <span className="material-symbols-rounded text-[20px]">arrow_back</span>
          </a>
          {!isDm && (
            <span className="text-gray-400 text-sm">{isPrivate ? "🔒" : "#"}</span>
          )}
          <h2 className="font-semibold text-gray-900 truncate text-sm md:text-base">{name}</h2>
          {topic && (
            <span className="text-sm text-gray-500 truncate ml-2 hidden md:inline">
              {topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {!isDm && (
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded text-[18px]">group</span>
              {memberCount}
            </button>
          )}
        </div>
      </div>

      {/* Members panel */}
      {showMembers && (
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Members ({memberCount})</h3>
            <div className="flex items-center gap-2">
              {!isDm && (
                <button
                  onClick={openAddMember}
                  className="text-[#7C3AED] hover:text-[#6D28D9] transition-colors text-xs font-medium flex items-center gap-1"
                >
                  <span className="material-symbols-rounded text-[16px]">person_add</span>
                  Add
                </button>
              )}
              <button
                onClick={() => { setShowMembers(false); setShowAddMember(false); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="material-symbols-rounded text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Add member search */}
          {showAddMember && (
            <div className="mb-3 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people to add..."
                autoFocus
                className="w-full px-3 py-2 text-sm outline-none border-b border-gray-100"
              />
              <div className="max-h-36 overflow-y-auto">
                {filteredAvailable.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => handleAddMember(m.id)}
                    disabled={adding}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                  >
                    {m.profilePhoto ? (
                      <img src={m.profilePhoto} alt={`${m.firstName} ${m.lastName}`} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                        {getInitials(m.firstName, m.lastName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                      {m.jobTitle && <p className="text-[10px] text-gray-500 truncate">{m.jobTitle}</p>}
                    </div>
                    <span className="ml-auto text-[#7C3AED] text-xs">Add</span>
                  </button>
                ))}
                {filteredAvailable.length === 0 && (
                  <p className="text-center text-gray-400 text-xs py-3">
                    {availableMembers.length === 0 ? "Everyone is already in this channel" : "No matches"}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMemberClick(m.id)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left cursor-pointer"
                title={`Message ${m.firstName} ${m.lastName}`}
              >
                {m.profilePhoto ? (
                  <img src={m.profilePhoto} alt={`${m.firstName} ${m.lastName}`} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {getInitials(m.firstName, m.lastName)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                  {m.jobTitle && <p className="text-[11px] text-gray-500 truncate">{m.jobTitle}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
