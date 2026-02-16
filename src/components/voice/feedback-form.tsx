"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { submitAnonFeedback } from "@/lib/actions/voice";
import { useRouter } from "next/navigation";
import { Send, ShieldCheck } from "lucide-react";

export function FeedbackForm() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    await submitAnonFeedback(content.trim());
    setContent("");
    setLoading(false);
    setSubmitted(true);
    router.refresh();
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Submit Anonymous Feedback</h2>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Your identity is never recorded. Share honest feedback to help improve the workplace.
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="Share your thoughts, suggestions, or concerns..."
        className={cn(
          "w-full px-4 py-3 rounded-lg text-sm resize-none",
          "bg-[var(--color-background)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        )}
      />

      <div className="flex items-center justify-between mt-3">
        {submitted && (
          <p className="text-sm text-emerald-500 font-medium">Feedback submitted anonymously!</p>
        )}
        <div className="ml-auto">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)] transition-colors",
              "disabled:opacity-50"
            )}
          >
            <Send className="h-4 w-4" />
            {loading ? "Sending..." : "Submit Anonymously"}
          </button>
        </div>
      </div>
    </div>
  );
}
