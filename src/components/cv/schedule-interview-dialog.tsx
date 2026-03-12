"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useState } from "react";
import { scheduleInterview } from "@/lib/actions/interviews";
import { Loader2, Info } from "lucide-react";
import type { InterviewType } from "@/generated/prisma/client";
import Link from "next/link";

const interviewTypes: { value: InterviewType; label: string }[] = [
  { value: "PHONE_SCREEN", label: "Phone Screen" },
  { value: "VIDEO", label: "Video Interview" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "PANEL", label: "Panel" },
  { value: "FINAL", label: "Final Round" },
];

const durations = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export function ScheduleInterviewDialog({
  candidateName,
  candidateId,
  positionId,
  calendarConnected,
  open,
  onClose,
  onScheduled,
}: {
  candidateName: string;
  candidateId: string;
  positionId?: string | null;
  calendarConnected: boolean;
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<InterviewType>("VIDEO");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  async function handleSubmit() {
    if (!scheduledAt) return;
    setSubmitting(true);
    try {
      await scheduleInterview({
        candidateId,
        positionId: positionId ?? undefined,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
        duration,
        notes: notes || undefined,
      });
      onScheduled();
      onClose();
      setScheduledAt("");
      setNotes("");
      setType("VIDEO");
      setDuration(60);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Schedule Interview">
      <div className="space-y-3">
        {/* Candidate name */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Candidate
          </label>
          <div className={cn(inputClass, "bg-[var(--color-surface-hover)] cursor-default")}>
            {candidateName}
          </div>
        </div>

        {/* Interview type */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Interview Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InterviewType)}
            className={inputClass}
          >
            {interviewTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date/Time */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Date & Time
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={inputClass}
          >
            {durations.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={cn(inputClass, "resize-none")}
            placeholder="Interview agenda, topics to cover..."
          />
        </div>

        {/* Calendar status */}
        {calendarConnected ? (
          <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300">
              A Google Meet link will be created automatically and calendar invites will be sent to the candidate.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              Google Calendar is not connected. The interview will be saved without a Meet link.{" "}
              <Link href="/settings" className="underline hover:text-amber-200">
                Connect in Settings
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !scheduledAt}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium text-white",
            "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
            "disabled:opacity-50"
          )}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scheduling...
            </span>
          ) : (
            "Schedule Interview"
          )}
        </button>
      </div>
    </Dialog>
  );
}
