"use client";

import { cn } from "@/lib/utils";
import { Send, Image, Paperclip, Star } from "lucide-react";
import { useState } from "react";
import { createFeedPost, createShoutoutPost } from "@/lib/actions/feed";

type EmployeeOption = { id: string; firstName: string; lastName: string };

export function PostComposer({
  employeeId,
  initials,
  employees,
}: {
  employeeId: string;
  initials: string;
  employees?: EmployeeOption[];
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"general" | "shoutout">("general");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  async function handlePost() {
    if (!content.trim()) return;
    setLoading(true);
    if (mode === "shoutout" && selectedEmployee) {
      await createShoutoutPost(employeeId, selectedEmployee, content.trim());
    } else {
      await createFeedPost({ authorId: employeeId, content: content.trim() });
    }
    setContent("");
    setSelectedEmployee("");
    setMode("general");
    setLoading(false);
  }

  return (
    <div
      className={cn(
        "rounded-xl p-4 mb-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-[var(--color-accent)] shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder={mode === "shoutout" ? "Give someone a shoutout..." : "What's on your mind?"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePost()}
            className={cn(
              "w-full rounded-lg px-4 py-2.5 text-sm",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
              "transition-all"
            )}
          />
        </div>
      </div>

      {mode === "shoutout" && employees && (
        <div className="mt-3 pl-[52px]">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            )}
          >
            <option value="">Select an employee to shoutout...</option>
            {employees
              .filter((e) => e.id !== employeeId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">
            <Image className="h-4 w-4" />
            Photo
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">
            <Paperclip className="h-4 w-4" />
            Attach
          </button>
          <button
            onClick={() => setMode(mode === "shoutout" ? "general" : "shoutout")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              mode === "shoutout"
                ? "text-yellow-500 bg-yellow-500/10"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Star className="h-4 w-4" />
            Shoutout
          </button>
        </div>
        <button
          onClick={handlePost}
          disabled={!content.trim() || loading || (mode === "shoutout" && !selectedEmployee)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "shadow-[0_0_12px_var(--color-accent-glow)]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Send className="h-4 w-4" />
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
