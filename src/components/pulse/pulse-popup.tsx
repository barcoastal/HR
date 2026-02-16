"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { submitPulseResponse } from "@/lib/actions/pulse";
import { X } from "lucide-react";

const moodEmojis = [
  { emoji: "😫", label: "Terrible", value: 1 },
  { emoji: "😟", label: "Bad", value: 2 },
  { emoji: "😐", label: "Okay", value: 3 },
  { emoji: "😊", label: "Good", value: 4 },
  { emoji: "🤩", label: "Great", value: 5 },
];

export function PulsePopup({
  surveyId,
  question,
  employeeId,
}: {
  surveyId: string;
  question: string;
  employeeId: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed || submitted) return null;

  async function handleResponse(mood: number) {
    setLoading(true);
    await submitPulseResponse(surveyId, employeeId, mood);
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className={cn(
      "fixed bottom-20 right-4 z-40 md:bottom-6",
      "w-80 rounded-xl p-4 shadow-xl",
      "bg-[var(--color-surface)] border border-[var(--color-border)]",
      "animate-in slide-in-from-bottom-4"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-wider mb-1">Quick Pulse</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{question}</p>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex justify-between gap-1">
        {moodEmojis.map((m) => (
          <button
            key={m.value}
            onClick={() => handleResponse(m.value)}
            disabled={loading}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors",
              "hover:bg-[var(--color-surface-hover)]",
              "disabled:opacity-50"
            )}
            title={m.label}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
