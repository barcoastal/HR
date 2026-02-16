"use client";

import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import { MessageCircle, Reply } from "lucide-react";
import { useState } from "react";
import { replyToAnonFeedback } from "@/lib/actions/voice";
import { useRouter } from "next/navigation";

type Feedback = {
  id: string;
  content: string;
  adminReply: string | null;
  createdAt: Date;
};

export function FeedbackList({ feedbacks }: { feedbacks: Feedback[] }) {
  const router = useRouter();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReply(id: string) {
    if (!replyContent.trim()) return;
    setSaving(true);
    await replyToAnonFeedback(id, replyContent.trim());
    setReplyContent("");
    setReplyingTo(null);
    setSaving(false);
    router.refresh();
  }

  if (feedbacks.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-3" />
        <p className="text-[var(--color-text-muted)]">No anonymous feedback received yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbacks.map((fb) => (
        <div key={fb.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-gray-500/20 flex items-center justify-center">
              <span className="text-sm">🎭</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Anonymous</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{timeAgo(fb.createdAt)}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-3">{fb.content}</p>

          {fb.adminReply && (
            <div className={cn("p-3 rounded-lg ml-4", "bg-[var(--color-accent)]/5 border-l-2 border-[var(--color-accent)]")}>
              <p className="text-xs font-medium text-[var(--color-accent)] mb-1">Admin Reply</p>
              <p className="text-sm text-[var(--color-text-primary)]">{fb.adminReply}</p>
            </div>
          )}

          {!fb.adminReply && (
            <>
              {replyingTo === fb.id ? (
                <div className="ml-4 space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={2}
                    placeholder="Write a reply..."
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm resize-none",
                      "bg-[var(--color-background)] border border-[var(--color-border)]",
                      "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                      "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                    )}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReply(fb.id)}
                      disabled={!replyContent.trim() || saving}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", "bg-[var(--color-accent)] text-white", "disabled:opacity-50")}
                    >
                      {saving ? "Sending..." : "Send Reply"}
                    </button>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyContent(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReplyingTo(fb.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 px-3 py-1.5 rounded-lg transition-colors ml-4"
                >
                  <Reply className="h-3.5 w-3.5" />Reply
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
