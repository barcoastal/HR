"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { sendEmergencyAlert } from "@/lib/actions/emergency-alerts";

export function AlertComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    emailsSent: number;
    emailsFailed: number;
    smsSent: number;
    smsFailed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && message.trim().length > 0;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await sendEmergencyAlert(title.trim(), message.trim());
      setResult(res);
      setTitle("");
      setMessage("");
    } catch (e: any) {
      setError(e.message || "Failed to send alert");
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="glass rounded-[var(--radius-xl)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <Icon name="warning" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[var(--color-on-surface)]">
            Send Emergency Alert
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            This will notify all employees via feed, email, and SMS.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Alert title"
        maxLength={100}
        className={cn(
          "w-full px-4 py-3 rounded-xl border border-[var(--color-border)]/60",
          "bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]",
          "placeholder:text-[var(--color-text-muted)] text-sm font-medium",
          "focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
        )}
      />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Alert message..."
        rows={4}
        className={cn(
          "w-full px-4 py-3 rounded-xl border border-[var(--color-border)]/60",
          "bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]",
          "placeholder:text-[var(--color-text-muted)] text-sm",
          "focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30",
          "resize-none"
        )}
      />

      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canSend || sending}
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all",
          canSend && !sending
            ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
            : "bg-[var(--color-surface-container)] text-[var(--color-text-muted)] cursor-not-allowed"
        )}
      >
        <Icon name="campaign" size={18} />
        Send Emergency Alert
      </button>

      {result && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-sm">
          <p className="font-bold text-green-700">Alert sent successfully!</p>
          <p className="text-green-600 mt-1">
            {result.emailsSent} emails sent
            {result.emailsFailed > 0 && `, ${result.emailsFailed} failed`}
            {" · "}
            {result.smsSent} SMS sent
            {result.smsFailed > 0 && `, ${result.smsFailed} failed`}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm">
          <p className="font-bold text-red-700">Failed to send</p>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Emergency Alert"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10">
            <Icon name="warning" size={24} className="text-red-500" />
            <p className="text-sm text-[var(--color-on-surface)]">
              This will send an email to <strong>all employees</strong> and SMS
              to those with phone numbers on file.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-container-lowest)] p-4">
            <p className="font-bold text-[var(--color-on-surface)]">{title}</p>
            <p className="text-sm text-[var(--color-on-surface-variant)] mt-1 whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold text-white transition-all",
                sending
                  ? "bg-red-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600"
              )}
            >
              {sending ? "Sending..." : "Confirm & Send"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
