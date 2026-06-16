"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { unmarkDoNotCall } from "@/lib/actions/candidate-applications";

type DncRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  doNotCall?: boolean;
  doNotCallReason?: string | null;
  createdAt: Date;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function DncList({ candidates }: { candidates: DncRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const dnc = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = candidates.filter((c) => c.doNotCall);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.doNotCallReason ?? "").toLowerCase().includes(q),
    );
  }, [candidates, search]);

  function handleUnmark(id: string, name: string) {
    if (!confirm(`Remove ${name} from the Do Not Call list?`)) return;
    setActingOn(id);
    startTransition(async () => {
      try {
        await unmarkDoNotCall(id);
        router.refresh();
      } finally {
        setActingOn(null);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Do Not Call</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Candidates flagged not to be contacted. {dnc.length} on file.
          </p>
        </div>
        <div className="relative flex-1 max-w-md">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, reason…"
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-lg text-sm",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
            )}
          />
        </div>
      </div>

      {dnc.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="block" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No DNC entries</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Mark a candidate Do Not Call from their detail dialog to add them here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {dnc.map((c) => {
            const initials = getInitials(c.firstName, c.lastName);
            const colorIdx = c.firstName.charCodeAt(0) % avatarColors.length;
            const isActing = actingOn === c.id && pending;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border p-3 flex items-center gap-3",
                  "bg-[var(--color-surface)] border-red-500/20 hover:border-red-500/40 transition-colors",
                )}
              >
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", avatarColors[colorIdx])}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {c.firstName} {c.lastName}
                    </p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500 text-white">DNC</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {c.email}
                    {c.phone && <span className="ml-2">· {c.phone}</span>}
                    {c.source && <span className="ml-2">· via {c.source}</span>}
                    <span className="ml-2">· added {timeAgo(c.createdAt)}</span>
                  </p>
                  {c.doNotCallReason && (
                    <p className="mt-1 text-[11px] text-red-500/80 truncate" title={c.doNotCallReason}>
                      Reason: {c.doNotCallReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`mailto:${c.email}`}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                    title="Email"
                  >
                    <Icon name="mail" size={14} />
                  </a>
                  <button
                    onClick={() => handleUnmark(c.id, `${c.firstName} ${c.lastName}`)}
                    disabled={isActing}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium",
                      "text-emerald-600 hover:bg-emerald-500/10",
                      "disabled:opacity-50",
                    )}
                    title="Remove from Do Not Call"
                  >
                    <Icon name="check_circle" size={12} />
                    {isActing ? "Removing…" : "Make callable"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
