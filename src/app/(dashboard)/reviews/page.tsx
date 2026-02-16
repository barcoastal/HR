import { cn, getInitials, formatDate } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ClipboardCheck, Clock, CheckCircle2, BarChart3, Calendar } from "lucide-react";

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  SUBMITTED: { color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  PENDING: { color: "text-[var(--color-text-muted)]", bg: "bg-[var(--color-surface-hover)]", icon: Clock },
};
const typeConfig: Record<string, string> = {
  SELF: "bg-blue-500/15 text-blue-400",
  MANAGER: "bg-purple-500/15 text-purple-400",
  PEER: "bg-cyan-500/15 text-cyan-400",
};
const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export default async function ReviewsPage() {
  await requireAuth();

  const cycle = await db.reviewCycle.findFirst({
    where: { status: "ACTIVE" },
    include: {
      reviews: {
        include: { employee: true, reviewer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!cycle) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">Reviews</h1>
        <p className="text-[var(--color-text-muted)]">No active review cycle.</p>
      </div>
    );
  }

  const submitted = cycle.reviews.filter((r) => r.status === "SUBMITTED").length;
  const pending = cycle.reviews.length - submitted;
  const progressPercent = cycle.reviews.length > 0 ? Math.round((submitted / cycle.reviews.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Reviews</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Performance review cycles and submissions</p>
      </div>

      <div className={cn("rounded-xl p-6 mb-8", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{cycle.name}</h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
            </div>
          </div>
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">Active</span>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Overall Progress</span>
            <span className="text-sm text-[var(--color-text-muted)]">{submitted}/{cycle.reviews.length} completed ({progressPercent}%)</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--color-background)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Pending</span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{pending}</p>
          </div>
          <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Submitted</span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{submitted}</p>
          </div>
        </div>
      </div>

      <div className="mb-4"><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recent Reviews</h2></div>
      <div className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Employee</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Reviewer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {cycle.reviews.map((review) => {
                const cfg = statusConfig[review.status] || statusConfig.PENDING;
                const StatusIcon = cfg.icon;
                const empInitials = getInitials(review.employee.firstName, review.employee.lastName);
                const colorIdx = review.employee.firstName.charCodeAt(0) % avatarColors.length;
                return (
                  <tr key={review.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{empInitials}</div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{review.employee.firstName} {review.employee.lastName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-text-primary)]">{review.reviewer.firstName} {review.reviewer.lastName}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", typeConfig[review.type] || "")}>{review.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
                        <StatusIcon className="h-3 w-3" />{review.status}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {cycle.reviews.map((review) => {
            const cfg = statusConfig[review.status] || statusConfig.PENDING;
            const StatusIcon = cfg.icon;
            const empInitials = getInitials(review.employee.firstName, review.employee.lastName);
            const colorIdx = review.employee.firstName.charCodeAt(0) % avatarColors.length;
            return (
              <div key={review.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{empInitials}</div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{review.employee.firstName} {review.employee.lastName}</span>
                  </div>
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
                    <StatusIcon className="h-3 w-3" />{review.status}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>Reviewer: {review.reviewer.firstName} {review.reviewer.lastName}</span>
                  <span>·</span>
                  <span className={cn("inline-flex px-1.5 py-0.5 rounded-full font-medium", typeConfig[review.type] || "")}>{review.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
