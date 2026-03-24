"use client";

import { useState } from "react";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { ChannelHeader } from "./channel-header";
import type { MessagePayload } from "@/lib/chat/ws-types";

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
  jobTitle: string | null;
}

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  channelName: string;
  channelTopic?: string;
  memberCount: number;
  isPrivate: boolean;
  isDm: boolean;
  members: Member[];
}

export function ChannelView({
  channelId,
  channelType,
  channelName,
  channelTopic,
  memberCount,
  isPrivate,
  isDm,
  members,
}: Props) {
  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);

  return (
    <div className="flex flex-col h-full">
      <ChannelHeader
        name={channelName}
        topic={channelTopic}
        memberCount={memberCount}
        isPrivate={isPrivate}
        isDm={isDm}
        channelId={channelId}
        members={members}
      />
      <MessageList onReply={(msg) => setReplyTo(msg)} />
      <TypingIndicator channelId={channelId} />

      {/* Reply reference bar */}
      {replyTo && (
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
          <div className="w-1 h-8 bg-[#7C3AED] rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#7C3AED] font-medium">
              Replying to {replyTo.author.firstName} {replyTo.author.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {replyTo.contentPlain || "attachment"}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
        </div>
      )}

      <MessageInput
        channelId={channelId}
        channelType={channelType}
        channelName={channelName}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </div>
  );
}
