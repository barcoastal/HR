"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getAllStageDocuments } from "@/lib/actions/stage-documents";
import { resendStageDocuments } from "@/lib/actions/candidates";

type DocItem = {
  id: string;
  name: string;
  hasPdf: boolean;
  requiresSignature: boolean;
  requiresFill: boolean;
};

const STAGE_LABEL: Record<string, string> = {
  PRE_ONBOARDING: "Pre-Onboarding",
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
};

export function ResendStageDocsButton({
  employeeId,
  employeeName,
  stage = "PRE_ONBOARDING",
  className,
}: {
  employeeId: string;
  employeeName: string;
  stage?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const firstName = employeeName.split(" ")[0] || employeeName;
  const selectableCount = docs.filter((d) => d.hasPdf).length;

  async function openModal() {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const all = await getAllStageDocuments();
      const list = all
        .filter((d) => d.stage === stage)
        .map((d) => ({
          id: d.id,
          name: d.name,
          hasPdf: d.hasPdf,
          requiresSignature: d.requiresSignature,
          requiresFill: d.requiresFill,
        }));
      setDocs(list);
      setSelected(new Set(list.filter((d) => d.hasPdf).map((d) => d.id)));
    } catch {
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setError("Select at least one document.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await resendStageDocuments(employeeId, stage, ids);
      if (res.success) {
        setOpen(false);
        alert(`Sent ${res.sent} document${res.sent === 1 ? "" : "s"} to ${employeeName}.`);
      } else {
        setError(res.error || "Failed to send.");
      }
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          className ||
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
        }
        title={`Resend ${STAGE_LABEL[stage] || stage} documents to ${employeeName}`}
      >
        <Icon name="forward_to_inbox" size={14} />
        Resend documents
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Resend {STAGE_LABEL[stage] || stage} documents
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                To {employeeName}. Pick which documents to send.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {loading ? (
                <p className="text-xs text-[var(--color-text-muted)]">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">No documents configured for this stage.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 pb-1">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(docs.filter((d) => d.hasPdf).map((d) => d.id)))}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-[var(--color-text-muted)] hover:underline"
                    >
                      Clear
                    </button>
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                      {selected.size} of {selectableCount} selected
                    </span>
                  </div>
                  {docs.map((d) => (
                    <label
                      key={d.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border",
                        d.hasPdf
                          ? "border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-hover)]"
                          : "border-amber-300/40 opacity-70 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        disabled={!d.hasPdf}
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[var(--color-text-primary)] truncate">{d.name}</span>
                        {!d.hasPdf && (
                          <span className="block text-[11px] text-amber-500">No PDF uploaded, cannot send</span>
                        )}
                      </span>
                      {d.requiresSignature && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">sign</span>
                      )}
                      {d.requiresFill && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500">fill</span>
                      )}
                    </label>
                  ))}
                </>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={sending || selected.size === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {sending ? "Sending…" : `Send ${selected.size > 0 ? selected.size : ""} to ${firstName}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
