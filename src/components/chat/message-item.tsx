"use client";

import type { MessagePayload } from "@/lib/chat/ws-types";

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

export function MessageItem({ message }: { message: MessagePayload }) {
  const { author } = message;
  const fullTime = new Date(message.createdAt).toLocaleString();

  return (
    <div className="flex gap-3 px-5 py-2 hover:bg-gray-50 group transition-colors">
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
        <div
          className="text-sm text-gray-800 mt-0.5 [&>p]:my-0 [&_code]:bg-gray-100 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-rose-600 [&_blockquote]:border-l-3 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#7C3AED] [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />
      </div>
    </div>
  );
}
