"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { ReviewFieldRenderer } from "@/components/reviews/review-field-renderer";
import type { TemplateField } from "@/lib/review-templates";

type ReviewInfo = {
  employeeName: string;
  reviewerName: string;
  type: string;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  goals: string | null;
  template?: TemplateField[] | null;
  responses?: Record<string, unknown> | null;
};

export function ViewReviewDialog({ review }: { review: ReviewInfo }) {
  const [open, setOpen] = useState(false);

  const hasTemplate = review.template && review.template.length > 0 && review.responses;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <Icon name="visibility" size={12} />View
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`${review.type} Review — ${review.employeeName}`}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Reviewed by</p>
            <p className="text-sm text-[var(--color-text-primary)]">{review.reviewerName}</p>
          </div>

          {hasTemplate ? (
            /* Dynamic template view */
            review.template!.map((field) => (
              <ReviewFieldRenderer
                key={field.id}
                field={field}
                value={review.responses![field.id]}
                onChange={() => {}}
                readOnly
              />
            ))
          ) : (
            /* Legacy hardcoded view */
            <>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Rating</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon key={n} name="star" fill={n <= (review.rating || 0)} className={cn("h-5 w-5", n <= (review.rating || 0) ? "text-amber-400" : "text-[var(--color-border)]")} />
                  ))}
                  <span className="ml-2 text-sm text-[var(--color-text-muted)]">{review.rating}/5</span>
                </div>
              </div>
              {review.strengths && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Strengths</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.strengths}</p>
                </div>
              )}
              {review.improvements && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Areas for Improvement</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.improvements}</p>
                </div>
              )}
              {review.goals && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Goals</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.goals}</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Close</button>
        </div>
      </Dialog>
    </>
  );
}
