"use client";

interface Props {
  name: string;
  topic?: string;
  memberCount: number;
  isPrivate: boolean;
  isDm: boolean;
}

export function ChannelHeader({ name, topic, memberCount, isPrivate, isDm }: Props) {
  return (
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
          <span className="flex items-center gap-1">
            <span className="material-symbols-rounded text-[18px]">group</span>
            {memberCount}
          </span>
        )}
      </div>
    </div>
  );
}
