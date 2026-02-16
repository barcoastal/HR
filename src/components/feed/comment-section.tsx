"use client";

import { cn } from "@/lib/utils";
import { getInitials, timeAgo } from "@/lib/utils";
import { Send } from "lucide-react";
import { useState } from "react";
import { createFeedComment } from "@/lib/actions/feed";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string };
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function CommentSection({
  postId,
  comments,
  currentEmployeeId,
}: {
  postId: string;
  comments: Comment[];
  currentEmployeeId: string;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || !currentEmployeeId) return;
    setLoading(true);
    await createFeedComment(postId, currentEmployeeId, content.trim());
    setContent("");
    setLoading(false);
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-3 mt-3 space-y-3">
      {comments.map((comment) => {
        const initials = getInitials(comment.author.firstName, comment.author.lastName);
        const colorIdx = comment.author.firstName.charCodeAt(0) % avatarColors.length;
        return (
          <div key={comment.id} className="flex items-start gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px] shrink-0",
                avatarColors[colorIdx]
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {comment.author.firstName} {comment.author.lastName}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{comment.content}</p>
            </div>
          </div>
        );
      })}

      {currentEmployeeId && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            )}
          />
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
