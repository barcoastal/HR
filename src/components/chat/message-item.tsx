"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import type { MessagePayload, AttachmentPayload, ReactionInfo } from "@/lib/chat/ws-types";
import { MessageActions } from "./message-actions";
import { ReactionBar } from "./reaction-bar";
import { editMessage } from "@/lib/actions/chat-messages";
import { VoiceMessagePlayer } from "./voice-recorder";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileAttachment({ attachment }: { attachment: AttachmentPayload }) {
  const isImage = attachment.fileType.startsWith("image/");
  const isAudio = attachment.fileType.startsWith("audio/");

  if (isAudio) {
    return <VoiceMessagePlayer url={attachment.url} />;
  }

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={attachment.url} alt={attachment.fileName} className="max-w-xs md:max-w-sm max-h-64 rounded-lg border border-gray-200 hover:border-[#7C3AED] transition-colors cursor-pointer" />
      </a>
    );
  }

  if (attachment.url.includes("meet.google.com")) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-[#1a73e8]/5 hover:bg-[#1a73e8]/10 rounded-lg px-4 py-3 transition-colors border border-[#1a73e8]/20">
        <span className="material-symbols-rounded text-[24px] text-[#1a73e8]">video_call</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1a73e8]">Google Meet</p>
          <p className="text-[11px] text-gray-500">{attachment.fileName || "Join video call"}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#1a73e8] text-white text-xs font-medium">Join</span>
      </a>
    );
  }

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-sm transition-colors">
      <span className="material-symbols-rounded text-[20px] text-gray-500">description</span>
      <div className="min-w-0">
        <p className="text-gray-900 truncate max-w-[200px]">{attachment.fileName}</p>
        <p className="text-[11px] text-gray-500">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <span className="material-symbols-rounded text-[16px] text-gray-400">download</span>
    </a>
  );
}

export function MessageItem({
  message,
  isGrouped = false,
  onReply,
}: {
  message: MessagePayload;
  isGrouped?: boolean;
  onReply?: (msg: MessagePayload) => void;
}) {
  const { data: session } = useSession();
  const { author } = message;
  const fullTime = new Date(message.createdAt).toLocaleString();
  const hasContent = message.contentPlain && !message.contentPlain.startsWith("[");
  const attachments = message.attachments || [];

  const channelId = message.channelId || message.dmThreadId || "";
  const isOwnMessage =
    message.authorId === "self" ||
    (!!session?.user?.employeeId && session.user.employeeId === message.authorId);

  const [localReactions, setLocalReactions] = useState<ReactionInfo[]>(message.reactions || []);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.contentPlain || "");
  const [saving, setSaving] = useState(false);

  // Group reactions by emoji
  const groupedReactions = Array.from(
    localReactions.reduce((map, r) => {
      const existing = map.get(r.emoji) || { emoji: r.emoji, count: 0, hasReacted: false };
      existing.count++;
      if (r.employeeId === session?.user?.employeeId) existing.hasReacted = true;
      map.set(r.emoji, existing);
      return map;
    }, new Map<string, { emoji: string; count: number; hasReacted: boolean }>())
  ).map(([, v]) => v);

  const handleReactionToggle = (emoji?: string) => {
    if (!emoji || !session?.user?.employeeId) return;
    const myId = session.user.employeeId;
    setLocalReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji && r.employeeId === myId);
      if (existing) {
        return prev.filter((r) => !(r.emoji === emoji && r.employeeId === myId));
      } else {
        return [...prev, { emoji, employeeId: myId }];
      }
    });
  };

  const handleEdit = async () => {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      await editMessage(message.id, editText.trim());
      setEditing(false);
    } catch (err) {
      console.error("Edit failed:", err);
    }
    setSaving(false);
  };

  const replyCount = message.replyCount ?? 0;

  // Reply preview bubble (like WhatsApp)
  const replyPreview = message.parentMessage ? (
    <div className="flex items-stretch gap-0 mb-1.5 cursor-pointer" onClick={() => {
      // Scroll to parent message
      const el = document.getElementById(`msg-${message.parentMessage?.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("bg-yellow-50");
      setTimeout(() => el?.classList.remove("bg-yellow-50"), 2000);
    }}>
      <div className="w-1 bg-[#7C3AED] rounded-full shrink-0" />
      <div className="bg-[#7C3AED]/5 rounded-r-lg px-3 py-1.5 min-w-0">
        <p className="text-[11px] font-semibold text-[#7C3AED]">{message.parentMessage.authorName}</p>
        <p className="text-[12px] text-gray-600 truncate">{message.parentMessage.contentPlain?.slice(0, 80) || "attachment"}</p>
      </div>
    </div>
  ) : null;

  // Read receipt checkmarks for own messages
  const readReceipt = isOwnMessage && message.id && !message.id.startsWith("temp-") ? (
    <span className="inline-flex items-center ml-1" title="Sent">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-[#7C3AED]">
        <path d="M1.5 5L5 8.5L14.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5L8.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
      </svg>
    </span>
  ) : null;

  // Content block (shared between grouped and full)
  const contentBlock = (
    <>
      {replyPreview}
      {editing ? (
        <div className="mt-1">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); } if (e.key === "Escape") setEditing(false); }}
            className="w-full px-3 py-2 text-sm border border-[#7C3AED] rounded-lg outline-none focus:ring-1 focus:ring-[#7C3AED]/30 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2 mt-1">
            <button onClick={handleEdit} disabled={saving} className="text-xs px-2 py-1 bg-[#007a5a] text-white rounded font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <span className="text-[10px] text-gray-400">Esc to cancel · Enter to save</span>
          </div>
        </div>
      ) : (
        <>
          {hasContent && (
            <div
              className="text-[15px] text-gray-800 mt-0.5 leading-relaxed [&>p]:my-0 [&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-rose-600 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#1264a3] [&_a]:hover:underline"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          )}
        </>
      )}
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <FileAttachment key={att.id} attachment={att} />
          ))}
        </div>
      )}
      <ReactionBar messageId={message.id} reactions={groupedReactions} onReactionToggle={handleReactionToggle} />
      {replyCount > 0 && (
        <button
          onClick={() => onReply?.(message)}
          className="flex items-center gap-1.5 mt-1 text-xs text-[#1264a3] hover:underline"
        >
          <span className="material-symbols-rounded text-[14px]">reply</span>
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </button>
      )}
    </>
  );

  // Grouped message
  if (isGrouped) {
    return (
      <div id={`msg-${message.id}`} className="flex gap-3 px-5 py-0.5 hover:bg-gray-50 group transition-colors relative">
        <div className="w-9 flex items-center justify-center shrink-0">
          <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" title={fullTime}>
            {formatTime(message.createdAt)}
          </span>
        </div>
        <div className="min-w-0 flex-1">{contentBlock}</div>
        <MessageActions
          messageId={message.id}
          channelId={channelId}
          isOwnMessage={isOwnMessage}
          onEdit={() => setEditing(true)}
          onRefresh={handleReactionToggle}
          onReplyInThread={() => onReply?.(message)}
        />
      </div>
    );
  }

  // Full message
  return (
    <div id={`msg-${message.id}`} className="flex gap-3 px-5 pt-2 pb-1 hover:bg-gray-50 group transition-colors relative mt-1">
      {author.profilePhoto ? (
        <img src={author.profilePhoto} alt={`${author.firstName} ${author.lastName}`} className="w-9 h-9 rounded-lg object-cover flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
          {getInitials(author.firstName, author.lastName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-[15px] text-gray-900">{author.firstName} {author.lastName}</span>
          <span className="text-xs text-gray-500 cursor-default" title={fullTime}>{formatTime(message.createdAt)}</span>
          {readReceipt}
        </div>
        {contentBlock}
      </div>
      <MessageActions
        messageId={message.id}
        channelId={channelId}
        isOwnMessage={isOwnMessage}
        onEdit={() => setEditing(true)}
        onRefresh={handleReactionToggle}
        onReplyInThread={() => onReply?.(message)}
      />
    </div>
  );
}
