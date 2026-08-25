"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { scheduleInterview } from "@/lib/actions/interviews";
import type { InterviewType } from "@/generated/prisma/client";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

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
  recruiters = [],
  defaultInterviewerId,
  calendarConnected,
  open,
  onClose,
  onScheduled,
}: {
  candidateName: string;
  candidateId: string;
  positionId?: string | null;
  recruiters?: { id: string; firstName: string; lastName: string }[];
  defaultInterviewerId?: string | null;
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
  const [interviewerId, setInterviewerId] = useState(defaultInterviewerId || recruiters[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const selectedInterviewer = recruiters.find((recruiter) => recruiter.id === interviewerId);

  useEffect(() => {
    if (open) {
      setInterviewerId(defaultInterviewerId || recruiters[0]?.id || "");
      setError(null);
    }
  }, [defaultInterviewerId, open, recruiters]);

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  async function handleSubmit() {
    if (!scheduledAt) return;
    setSubmitting(true);
    setError(null);
    try {
      await scheduleInterview({
        candidateId,
        positionId: positionId ?? undefined,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
        duration,
        notes: notes || undefined,
        interviewerId: interviewerId || undefined,
      });
      onScheduled();
      onClose();
      setScheduledAt("");
      setNotes("");
      setType("VIDEO");
      setDuration(60);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The interview could not be scheduled");
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

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
            Interviewer / Recruiter
          </label>
          <select
            value={interviewerId}
            onChange={(event) => setInterviewerId(event.target.value)}
            className={inputClass}
          >
            {recruiters.length === 0 && <option value="">Current signed-in recruiter</option>}
            {recruiters.map((recruiter) => (
              <option key={recruiter.id} value={recruiter.id}>
                {recruiter.firstName} {recruiter.lastName}
              </option>
            ))}
          </select>
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
            <Icon name="info" size={16} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300">
              One branded invitation will be sent from {selectedInterviewer
                ? `${selectedInterviewer.firstName} ${selectedInterviewer.lastName}`
                : "the recruiter"}. It includes the Google Meet details and an attached calendar RSVP.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
            <Icon name="info" size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">
              One branded invitation with a calendar RSVP will still be sent, but it will not include a Meet link until Google Calendar is connected.{" "}
              <Link href="/settings" className="underline hover:text-amber-200">
                Connect in Settings
              </Link>
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
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
              <Icon name="progress_activity" size={16} className="animate-material-spin" />
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
