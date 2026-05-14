"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreEmployee, purgeEmployee } from "@/lib/actions/employees";

export function ArchiveActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await restoreEmployee(id);
            router.refresh();
          })
        }
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
      >
        Restore
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            `Permanently delete ${name}? This cannot be undone — all records will be removed.`
          );
          if (!confirmed) return;
          startTransition(async () => {
            await purgeEmployee(id);
            router.refresh();
          });
        }}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-50"
      >
        Delete permanently
      </button>
    </div>
  );
}
