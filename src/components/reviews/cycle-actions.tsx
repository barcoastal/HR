"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { updateReviewCycleStatus, deleteReviewCycle } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Play, Square, Trash2 } from "lucide-react";

export function CycleActions({
  cycleId,
  status,
}: {
  cycleId: string;
  status: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleActivate() {
    setLoading(true);
    await updateReviewCycleStatus(cycleId, "ACTIVE");
    setLoading(false);
    router.refresh();
  }

  async function handleClose() {
    setLoading(true);
    await updateReviewCycleStatus(cycleId, "CLOSED");
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this review cycle? All reviews in it will be deleted.")) return;
    setLoading(true);
    await deleteReviewCycle(cycleId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <button
          onClick={handleActivate}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors",
            "disabled:opacity-50"
          )}
        >
          <Play className="h-3.5 w-3.5" />Activate
        </button>
      )}
      {status === "ACTIVE" && (
        <button
          onClick={handleClose}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors",
            "disabled:opacity-50"
          )}
        >
          <Square className="h-3.5 w-3.5" />Close
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-red-400 hover:bg-red-500/10 transition-colors",
          "disabled:opacity-50"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
