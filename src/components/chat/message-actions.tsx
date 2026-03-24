"use client";

import { useState } from "react";
import { deleteMessage, pinMessage, saveMessage } from "@/lib/actions/chat-messages";
import { toggleReaction } from "@/lib/actions/chat-reactions";

interface Props {
  messageId: string;
  channelId: string;
  isOwnMessage: boolean;
  onEdit?: () => void;
  onRefresh?: () => void;
  onReplyInThread?: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"];

export function MessageActions({ messageId, channelId, isOwnMessage, onEdit, onRefresh, onReplyInThread }: Props) {
  const [showEmojiRow, setShowEmojiRow] = useState(false);

  const handleReact = async (emoji: string) => {
    await toggleReaction(messageId, emoji);
    setShowEmojiRow(false);
    onRefresh?.();
  };

  const handleDelete = async () => {
    if (confirm("Delete this message?")) {
      await deleteMessage(messageId);
    }
  };

  const handlePin = async () => {
    await pinMessage(messageId, channelId);
    onRefresh?.();
  };

  const handleSave = async () => {
    await saveMessage(messageId);
    onRefresh?.();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chat/${channelId}#${messageId}`);
  };

  return (
    <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      {showEmojiRow && (
        <div className="flex gap-1 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} onClick={() => handleReact(emoji)} className="hover:scale-125 transition-transform text-base">
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200">
        <ActionButton icon="mood" title="React" onClick={() => setShowEmojiRow(!showEmojiRow)} />
        <ActionButton icon="chat_bubble" title="Reply in thread" onClick={onReplyInThread} />
        {isOwnMessage && <ActionButton icon="edit" title="Edit" onClick={onEdit} />}
        <ActionButton icon="push_pin" title="Pin" onClick={handlePin} />
        <ActionButton icon="bookmark" title="Save" onClick={handleSave} />
        <ActionButton icon="link" title="Copy link" onClick={handleCopyLink} />
        {isOwnMessage && <ActionButton icon="delete" title="Delete" onClick={handleDelete} className="text-red-400 hover:text-red-600" />}
      </div>
    </div>
  );
}

function ActionButton({ icon, title, onClick, className = "" }: { icon: string; title: string; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ${className}`}
    >
      <span className="material-symbols-rounded text-[16px]">{icon}</span>
    </button>
  );
}
