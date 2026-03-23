"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { submitReview } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ReviewFieldRenderer } from "@/components/reviews/review-field-renderer";
import type { TemplateField } from "@/lib/review-templates";

type ReviewData = {
  id: string;
  employeeName: string;
  type: string;
  template?: TemplateField[] | null;
};

export function SubmitReviewDialog({ review }: { review: ReviewData }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Legacy form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [goals, setGoals] = useState("");

  // Template-based state
  const [responses, setResponses] = useState<Record<string, unknown>>({});

  const hasTemplate = review.template && review.template.length > 0;

  function updateResponse(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      if (hasTemplate) {
        await submitReview(review.id, { responses });
      } else {
        if (rating === 0) return;
        await submitReview(review.id, { rating, strengths, improvements, goals });
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = hasTemplate
    ? review.template!.filter((f) => f.required).every((f) => {
        const val = responses[f.id];
        return val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0);
      })
    : rating > 0;

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const activeRating = hoverRating || rating;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium",
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        )}
      >
        Submit Review
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`${review.type} Review for ${review.employeeName}`}>
        <div className="space-y-4">
          {hasTemplate ? (
            /* Dynamic template form */
            review.template!.map((field) => (
              <ReviewFieldRenderer
                key={field.id}
                field={field}
                value={responses[field.id]}
                onChange={(val) => updateResponse(field.id, val)}
              />
            ))
          ) : (
            /* Legacy hardcoded form */
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Icon name="star" className={cn(
                        "h-7 w-7 transition-colors",
                        n <= activeRating ? "text-amber-400 fill-amber-400" : "text-[var(--color-border)]"
                      )} />
                    </button>
                  ))}
                  {rating > 0 && <span className="ml-2 text-sm text-[var(--color-text-muted)] self-center">{rating}/5</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Strengths</label>
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="What does this person do well?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Areas for Improvement</label>
                <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Where can they grow?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Goals for Next Period</label>
                <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="What should they focus on?" rows={3} className={inputClass} />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
