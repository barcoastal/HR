"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPollPost } from "@/lib/actions/feed";
import { Icon } from "@/components/ui/icon";

type Visibility = "OPEN" | "PUBLIC_ANONYMOUS" | "ADMIN_ANONYMOUS";

const VISIBILITY_DESCRIPTIONS: Record<Visibility, { title: string; sub: string; icon: string; tint: string }> = {
  OPEN: {
    title: "Open — everyone sees who voted",
    sub: "Names + votes visible to everyone in the company.",
    icon: "groups",
    tint: "text-emerald-500",
  },
  PUBLIC_ANONYMOUS: {
    title: "Anonymous — everyone sees percentages",
    sub: "Names are hidden. Everyone (you included) only sees totals.",
    icon: "visibility_off",
    tint: "text-blue-500",
  },
  ADMIN_ANONYMOUS: {
    title: "Anonymous — only super admins see results",
    sub: "Voters stay anonymous. Non-admins can vote but won't see results.",
    icon: "admin_panel_settings",
    tint: "text-purple-500",
  },
};

export function CreatePollDialog({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [visibility, setVisibility] = useState<Visibility>("OPEN");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"all" | "none">("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && cleanOptions.length >= 2;

  function setOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }
  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPollPost({
        authorId: employeeId,
        question: question.trim(),
        options: cleanOptions,
        visibility,
        allowMultiple,
        emailTarget,
      });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create poll");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={cn(
          "w-full max-w-lg max-h-[90vh] overflow-y-auto",
          "rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Icon name="ballot" size={20} className="text-[var(--color-accent)]" />
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Create a poll</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder="What do you want to ask?"
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm resize-none",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Options</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => setOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-2 text-sm",
                      "bg-[var(--color-background)] border border-[var(--color-border)]",
                      "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                      "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                    )}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(idx)}
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button
                  onClick={addOption}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                >
                  <Icon name="add" size={14} />
                  Add option
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">Visibility</label>
            <div className="space-y-2">
              {(Object.keys(VISIBILITY_DESCRIPTIONS) as Visibility[]).map((key) => {
                const meta = VISIBILITY_DESCRIPTIONS[key];
                const active = visibility === key;
                return (
                  <button
                    key={key}
                    onClick={() => setVisibility(key)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                        : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                    )}
                  >
                    <Icon name={meta.icon} size={20} className={cn("mt-0.5 shrink-0", meta.tint)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{meta.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{meta.sub}</p>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                        active ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
                      )}
                    >
                      {active && <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Allow multiple selections
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={emailTarget === "all"}
                onChange={() => setEmailTarget(emailTarget === "all" ? "none" : "all")}
                className="accent-[var(--color-accent)]"
              />
              Email all
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Icon name="send" size={14} />
            {submitting ? "Posting…" : "Post poll"}
          </button>
        </div>
      </div>
    </div>
  );
}
