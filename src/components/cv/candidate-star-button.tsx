"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { setCandidateStarred } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shared team star for a candidate. Optimistic: flips immediately, rolls back
 * if the server refuses. Stops click propagation so it can sit inside rows
 * and cards that open something on click.
 */
export function CandidateStarButton({
  candidateId,
  starred,
  size = 14,
  className,
  onChange,
}: {
  candidateId: string;
  starred: boolean;
  size?: number;
  className?: string;
  onChange?: (starred: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(starred);
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(starred), [starred]);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    const next = !value;
    setValue(next);
    setBusy(true);
    try {
      const res = await setCandidateStarred(candidateId, next);
      if (!res.success) {
        setValue(!next);
        alert(res.error || "Could not update the star");
        return;
      }
      onChange?.(next);
      router.refresh();
    } catch {
      setValue(!next);
    } finally {
      setBusy(false);
    }
  }

  const label = value ? "Unstar candidate" : "Star candidate";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={value}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded p-0.5 shrink-0 transition-colors disabled:opacity-60",
        value
          ? "text-amber-500 hover:text-amber-600"
          : "text-[var(--color-text-muted)] hover:text-amber-500",
        className
      )}
    >
      <Icon name="star" fill={value} size={size} />
    </button>
  );
}
