"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createFeedEvent } from "@/lib/actions/feed-events";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function CreateEventDialog({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate || !eventEndDate) return;
    setLoading(true);
    try {
      await createFeedEvent({
        authorId: employeeId,
        content: title.trim(),
        eventDate,
        eventEndDate,
        eventLocation: eventLocation.trim() || undefined,
      });
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={cn("w-full max-w-lg rounded-2xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Create Event</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)]">
            <Icon name="close" size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">Event Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team lunch, all-hands meeting..." required className={cn("w-full rounded-lg px-3 py-2 text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">Start</label>
              <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required className={cn("w-full rounded-lg px-3 py-2 text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")} />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">End</label>
              <input type="datetime-local" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} required className={cn("w-full rounded-lg px-3 py-2 text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">Location (optional)</label>
            <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Office, Zoom link, restaurant..." className={cn("w-full rounded-lg px-3 py-2 text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
            <button type="submit" disabled={!title.trim() || !eventDate || !eventEndDate || loading} className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50 disabled:cursor-not-allowed")}>
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
