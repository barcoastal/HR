import { requireAuth } from "@/lib/auth-helpers";
import { getMyCountersignQueue } from "@/lib/actions/countersign";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SignQueuePage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <PageHeader title="Sign Queue" description="Documents awaiting your countersignature" />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          You don&apos;t have permission to countersign documents.
        </div>
      </div>
    );
  }

  const queue = await getMyCountersignQueue();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader title="Sign Queue" description="Documents awaiting your countersignature" />

      {queue.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="task_alt" size={40} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">You&apos;re all caught up</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">No documents need your countersignature right now.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          {queue.map((req, i) => {
            const signerName = req.employee
              ? `${req.employee.firstName} ${req.employee.lastName}`
              : req.candidate
              ? `${req.candidate.firstName} ${req.candidate.lastName}`
              : req.signerName || "Unknown";
            return (
              <Link
                key={req.id}
                href={`/sign-queue/${req.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg)] transition-colors ${i > 0 ? "border-t border-[var(--color-border)]" : ""}`}
              >
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="draw" size={18} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{req.documentName}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Signed by <strong>{signerName}</strong>
                    {req.signedAt && <> on {formatDate(req.signedAt)}</>}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700">
                  Awaiting your signature
                </span>
                <Icon name="chevron_right" size={18} className="text-[var(--color-text-muted)]" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
