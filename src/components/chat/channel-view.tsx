"use client";

import { useState, useCallback } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  }, []);

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#7C3AED]/5 border-2 border-dashed border-[#7C3AED] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-center">
            <span className="material-symbols-rounded text-[40px] text-[#7C3AED]">upload_file</span>
            <p className="text-sm font-medium text-gray-900 mt-2">Drop files to upload</p>
            <p className="text-xs text-gray-500">Files will be attached to your message</p>
          </div>
        </div>
      )}

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
        droppedFiles={droppedFiles}
        onClearDroppedFiles={() => setDroppedFiles([])}
      />
    </div>
  );
}
