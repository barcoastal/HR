"use client";

import type { MessagePayload, AttachmentPayload } from "@/lib/chat/ws-types";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileAttachment({ attachment }: { attachment: AttachmentPayload }) {
  const isImage = attachment.fileType.startsWith("image/");

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-w-xs md:max-w-sm max-h-64 rounded-lg border border-gray-200 hover:border-[#7C3AED] transition-colors cursor-pointer"
        />
      </a>
    );
  }

  // Google Meet link card
  if (attachment.url.includes("meet.google.com")) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 bg-[#1a73e8]/5 hover:bg-[#1a73e8]/10 rounded-lg px-4 py-3 transition-colors border border-[#1a73e8]/20"
      >
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
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      <span className="material-symbols-rounded text-[20px] text-gray-500">description</span>
      <div className="min-w-0">
        <p className="text-gray-900 truncate max-w-[200px]">{attachment.fileName}</p>
        <p className="text-[11px] text-gray-500">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <span className="material-symbols-rounded text-[16px] text-gray-400">download</span>
    </a>
  );
}

export function MessageItem({ message, isGrouped = false }: { message: MessagePayload; isGrouped?: boolean }) {
  const { author } = message;
  const fullTime = new Date(message.createdAt).toLocaleString();
  const hasContent = message.contentPlain && !message.contentPlain.startsWith("[");
  const attachments = message.attachments || [];

  // Grouped message (same author, within 5 min) — no avatar, just content with hover timestamp
  if (isGrouped) {
    return (
      <div className="flex gap-3 px-5 py-0.5 hover:bg-gray-50 group transition-colors relative">
        {/* Hover timestamp in avatar column */}
        <div className="w-9 flex items-center justify-center shrink-0">
          <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" title={fullTime}>
            {formatTime(message.createdAt)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {hasContent && (
            <div
              className="text-sm text-gray-800 [&>p]:my-0 [&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-rose-600 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#7C3AED] [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          )}
          {attachments.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <FileAttachment key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full message with avatar
  return (
    <div className="flex gap-3 px-5 pt-2 pb-1 hover:bg-gray-50 group transition-colors relative mt-1">
      {author.profilePhoto ? (
        <img
          src={author.profilePhoto}
          alt={`${author.firstName} ${author.lastName}`}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
          {getInitials(author.firstName, author.lastName)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-[15px] text-gray-900 hover:underline cursor-pointer">
            {author.firstName} {author.lastName}
          </span>
          <span className="text-xs text-gray-500 cursor-default" title={fullTime}>
            {formatTime(message.createdAt)}
          </span>
        </div>
        {hasContent && (
          <div
            className="text-[15px] text-gray-800 mt-0.5 leading-relaxed [&>p]:my-0 [&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-rose-600 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#1264a3] [&_a]:hover:underline"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
        )}
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <FileAttachment key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
