import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Clock,
  Send,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Calendar,
} from "lucide-react";

const cycleStats = {
  name: "Q1 2025 Performance Review",
  startDate: "Jan 6, 2025",
  endDate: "Mar 14, 2025",
  completed: 24,
  total: 48,
  pending: 12,
  inProgress: 12,
  submitted: 24,
};

const recentReviews = [
  {
    employee: "Alex Rivera",
    employeeInitials: "AR",
    employeeColor: "bg-emerald-500",
    reviewer: "David Park",
    type: "Manager",
    status: "Submitted",
    submittedDate: "Feb 8, 2025",
  },
  {
    employee: "Alex Rivera",
    employeeInitials: "AR",
    employeeColor: "bg-emerald-500",
    reviewer: "Alex Rivera",
    type: "Self",
    status: "Submitted",
    submittedDate: "Feb 7, 2025",
  },
  {
    employee: "Priya Patel",
    employeeInitials: "PP",
    employeeColor: "bg-purple-500",
    reviewer: "Priya Patel",
    type: "Self",
    status: "In Progress",
    submittedDate: null,
  },
  {
    employee: "Mike Johnson",
    employeeInitials: "MJ",
    employeeColor: "bg-amber-500",
    reviewer: "Alex Rivera",
    type: "Manager",
    status: "Pending",
    submittedDate: null,
  },
  {
    employee: "Mike Johnson",
    employeeInitials: "MJ",
    employeeColor: "bg-amber-500",
    reviewer: "Mike Johnson",
    type: "Self",
    status: "Submitted",
    submittedDate: "Feb 5, 2025",
  },
  {
    employee: "Luna Martinez",
    employeeInitials: "LM",
    employeeColor: "bg-pink-500",
    reviewer: "James O'Connor",
    type: "Manager",
    status: "In Progress",
    submittedDate: null,
  },
  {
    employee: "Emma Wilson",
    employeeInitials: "EW",
    employeeColor: "bg-rose-500",
    reviewer: "Emma Wilson",
    type: "Self",
    status: "Pending",
    submittedDate: null,
  },
];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Submitted: { color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  "In Progress": { color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
  Pending: { color: "text-[var(--color-text-muted)]", bg: "bg-[var(--color-surface-hover)]", icon: Clock },
};

const typeConfig: Record<string, string> = {
  Self: "bg-blue-500/15 text-blue-400",
  Manager: "bg-purple-500/15 text-purple-400",
};

export default function ReviewsPage() {
  const progressPercent = Math.round(
    (cycleStats.completed / cycleStats.total) * 100
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Reviews</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Performance review cycles and submissions
        </p>
      </div>

      {/* Current Cycle Card */}
      <div
        className={cn(
          "rounded-xl p-6 mb-8",
          "bg-[var(--color-surface)] border border-[var(--color-border)]"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {cycleStats.name}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <Calendar className="h-3.5 w-3.5" />
              {cycleStats.startDate} — {cycleStats.endDate}
            </div>
          </div>
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
            Active
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Overall Progress
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              {cycleStats.completed}/{cycleStats.total} completed ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--color-background)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Pending</span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {cycleStats.pending}
            </p>
          </div>
          <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                In Progress
              </span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {cycleStats.inProgress}
            </p>
          </div>
          <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Submitted</span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">
              {cycleStats.submitted}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recent Reviews</h2>
      </div>
      <div
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-[var(--color-surface)] border border-[var(--color-border)]"
        )}
      >
        {/* Desktop Table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Employee
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Reviewer
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {recentReviews.map((review, idx) => {
                const statusCfg = statusConfig[review.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <tr
                    key={idx}
                    className="hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                            review.employeeColor
                          )}
                        >
                          {review.employeeInitials}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {review.employee}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-text-primary)]">
                      {review.reviewer}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                          typeConfig[review.type]
                        )}
                      >
                        {review.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          statusCfg.bg,
                          statusCfg.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {review.status}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)]">
                      {review.submittedDate ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {recentReviews.map((review, idx) => {
            const statusCfg = statusConfig[review.status];
            const StatusIcon = statusCfg.icon;
            return (
              <div key={idx} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                        review.employeeColor
                      )}
                    >
                      {review.employeeInitials}
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {review.employee}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      statusCfg.bg,
                      statusCfg.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {review.status}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>Reviewer: {review.reviewer}</span>
                  <span>·</span>
                  <span
                    className={cn(
                      "inline-flex px-1.5 py-0.5 rounded-full font-medium",
                      typeConfig[review.type]
                    )}
                  >
                    {review.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
