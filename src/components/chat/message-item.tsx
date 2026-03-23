"use client";

import type { MessagePayload, AttachmentPayload } from "@/lib/chat/ws-types";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
          className="max-w-sm max-h-64 rounded-lg border border-gray-200 hover:border-[#7C3AED] transition-colors cursor-pointer"
        />
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

export function MessageItem({ message }: { message: MessagePayload }) {
  const { author } = message;
  const fullTime = new Date(message.createdAt).toLocaleString();
  const hasContent = message.contentPlain && !message.contentPlain.startsWith("[");
  const attachments = message.attachments || [];

  return (
    <div className="flex gap-3 px-5 py-2 hover:bg-gray-50 group transition-colors relative">
      {author.profilePhoto ? (
        <img
          src={author.profilePhoto}
          alt={`${author.firstName} ${author.lastName}`}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {getInitials(author.firstName, author.lastName)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-gray-900">
            {author.firstName} {author.lastName}
          </span>
          <span className="text-[11px] text-gray-400 cursor-default" title={fullTime}>
            {timeAgo(message.createdAt)}
          </span>
        </div>
        {hasContent && (
          <div
            className="text-sm text-gray-800 mt-0.5 [&>p]:my-0 [&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-rose-600 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#7C3AED] [&_a]:underline"
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
