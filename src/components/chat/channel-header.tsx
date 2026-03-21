"use client";

import { useState } from "react";

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
  members?: Member[];
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export function ChannelHeader({ name, topic, memberCount, isPrivate, isDm, members = [] }: Props) {
  const [showMembers, setShowMembers] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {!isDm && (
            <span className="text-gray-400 text-sm">{isPrivate ? "🔒" : "#"}</span>
          )}
          <h2 className="font-semibold text-gray-900 truncate">{name}</h2>
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
            <button
              onClick={() => setShowMembers(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors">
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {m.firstName} {m.lastName}
                  </p>
                  {m.jobTitle && (
                    <p className="text-[11px] text-gray-500 truncate">{m.jobTitle}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
