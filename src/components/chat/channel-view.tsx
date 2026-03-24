"use client";

import { useState } from "react";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { ThreadPanel } from "./thread-panel";
import { ChannelHeader } from "./channel-header";
import { useChatStore } from "@/lib/chat/use-chat-store";
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
  const [threadMessage, setThreadMessage] = useState<MessagePayload | null>(null);

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChannelHeader
          name={channelName}
          topic={channelTopic}
          memberCount={memberCount}
          isPrivate={isPrivate}
          isDm={isDm}
          channelId={channelId}
          members={members}
        />
        <MessageList onReplyInThread={(msg) => setThreadMessage(msg)} />
        <TypingIndicator channelId={channelId} />
        <MessageInput
          channelId={channelId}
          channelType={channelType}
          channelName={channelName}
        />
      </div>

      {/* Thread panel */}
      {threadMessage && (
        <ThreadPanel
          parentMessage={threadMessage}
          channelId={channelId}
          channelType={channelType}
          onClose={() => setThreadMessage(null)}
        />
      )}
    </div>
  );
}
