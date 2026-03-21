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
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
          {message.contentPlain}
        </p>
      </div>
    </div>
  );
}
