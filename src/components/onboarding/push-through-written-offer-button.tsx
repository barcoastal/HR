"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { completePreOnboarding } from "@/lib/actions/employees";
import type { OutstandingDocument } from "@/lib/written-offer-override";

/**
 * Manual push-through for Written Offer, for when signed copies were collected
 * outside the system and the documents will never complete on their own.
 */
export function PushThroughWrittenOfferButton({
  employeeId,
  employeeName,
  outstandingDocuments,
  nextStep,
  onMoved,
}: {
  employeeId: string;
  employeeName: string;
  outstandingDocuments: OutstandingDocument[];
  nextStep: "Training" | "Onboarding";
  onMoved: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = employeeName.split(" ")[0] || employeeName;
  const hasOutstanding = outstandingDocuments.length > 0;
  const cancelsLinks = outstandingDocuments.some((document) => !document.awaitingCountersign);

  function openModal() {
    setOpen(true);
    setConfirmed(false);
    setError(null);
  }

  async function move() {
    setMoving(true);
    setError(null);
    try {
      const employee = await completePreOnboarding(employeeId);
      if (employee.status === "PRE_ONBOARDING") {
        setError(`${firstName} could not be moved. Refresh the page and try again.`);
        return;
      }
      setOpen(false);
      onMoved(employee.status);
    } catch {
      setError("Could not move this person. Please try again.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
        title={`Move ${employeeName} to ${nextStep} when documents were signed outside the system`}
      >
        <Icon name="arrow_forward" size={14} />
        Documents received
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !moving && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Move ${employeeName} to ${nextStep}`}
            className="bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Move {firstName} to {nextStep}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                For documents signed outside the system.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {hasOutstanding ? (
                <>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    {outstandingDocuments.length === 1 ? "This document was" : "These documents were"} not completed
                    through the system:
                  </p>
                  <ul className="space-y-2">
                    {outstandingDocuments.map((document, index) => (
                      <li
                        key={`${document.name}-${index}`}
                        className="flex items-start gap-2 p-2 rounded-lg border border-[var(--color-border)]"
                      >
                        <Icon name="description" size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <span className="min-w-0">
                          <span className="block text-sm text-[var(--color-text-primary)] break-words">{document.name}</span>
                          {document.awaitingCountersign && (
                            <span className="block text-[11px] text-[var(--color-text-muted)]">
                              Signed in the system, waiting on the countersignature. That request stays open.
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex cursor-pointer items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={moving}
                      onChange={(event) => setConfirmed(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span className="text-xs leading-5 text-[var(--color-text-primary)]">
                      I confirm a signed copy of {outstandingDocuments.length === 1 ? "this document" : "each document"} is on file.
                    </span>
                  </label>
                  <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
                    {cancelsLinks && "Open signing links for these documents are cancelled. "}
                    This is recorded in the audit log under your name.
                  </p>
                </>
              ) : (
                <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                  Every required document is complete. {firstName} moves to {nextStep} now.
                </p>
              )}
              {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={moving}
                className="px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={move}
                disabled={moving || (hasOutstanding && !confirmed)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {moving ? "Moving…" : `Move to ${nextStep}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
