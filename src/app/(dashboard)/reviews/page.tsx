import { cn, getInitials, formatDate } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getEmployees } from "@/lib/actions/employees";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Calendar,
  Star,
  FileText,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CreateCycleDialog } from "@/components/reviews/create-cycle-dialog";
import { AddReviewDialog } from "@/components/reviews/add-review-dialog";
import { SubmitReviewDialog } from "@/components/reviews/submit-review-dialog";
import { ViewReviewDialog } from "@/components/reviews/view-review-dialog";
import { CycleActions } from "@/components/reviews/cycle-actions";

const statusConfig: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  SUBMITTED: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    icon: CheckCircle2,
  },
  PENDING: {
    color: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-surface-hover)]",
    icon: Clock,
  },
};
const typeConfig: Record<string, string> = {
  SELF: "bg-blue-500/15 text-blue-400",
  MANAGER: "bg-purple-500/15 text-purple-400",
  PEER: "bg-cyan-500/15 text-cyan-400",
};
const cycleStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-500/15 text-gray-400" },
  ACTIVE: { label: "Active", color: "bg-blue-500/15 text-blue-400" },
  CLOSED: { label: "Closed", color: "bg-amber-500/15 text-amber-400" },
};
const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
];

export default async function ReviewsPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const currentEmployeeId = session.user?.employeeId;

  const [cycles, employees] = await Promise.all([
    db.reviewCycle.findMany({
      include: {
        reviews: {
          include: { employee: true, reviewer: true },
          orderBy: { createdAt: "desc" },
          // Non-admin employees only see reviews where they are the subject or reviewer
          ...(!isAdmin && currentEmployeeId
            ? {
                where: {
                  OR: [
                    { employeeId: currentEmployeeId },
                    { reviewerId: currentEmployeeId },
                  ],
                },
              }
            : {}),
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getEmployees(),
  ]);

  const employeeList = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  // Stats
  const totalCycles = cycles.length;
  const activeCycles = cycles.filter((c) => c.status === "ACTIVE").length;
  const allReviews = cycles.flatMap((c) => c.reviews);
  const submittedReviews = allReviews.filter(
    (r) => r.status === "SUBMITTED"
  ).length;
  const avgRating =
    allReviews.filter((r) => r.rating).length > 0
      ? (
          allReviews
            .filter((r) => r.rating)
            .reduce((acc, r) => acc + (r.rating || 0), 0) /
          allReviews.filter((r) => r.rating).length
        ).toFixed(1)
      : "—";

  // My pending reviews
  const myPendingReviews = currentEmployeeId
    ? allReviews.filter(
        (r) =>
          r.reviewerId === currentEmployeeId &&
          r.status === "PENDING" &&
          cycles.find((c) => c.id === r.cycleId)?.status === "ACTIVE"
      )
    : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Reviews"
          description="Performance review cycles and submissions"
        />
        {isAdmin && <CreateCycleDialog />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Cycles"
          value={totalCycles}
          icon={<ClipboardCheck className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Active Cycles"
          value={activeCycles}
          icon={<Calendar className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Reviews Submitted"
          value={submittedReviews}
          icon={<FileText className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Avg Rating"
          value={avgRating}
          icon={<Star className="h-5 w-5" />}
          color="amber"
          animate={false}
        />
      </div>

      {/* My pending reviews */}
      {myPendingReviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
            Your Pending Reviews
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myPendingReviews.map((review) => {
              const empInitials = getInitials(
                review.employee.firstName,
                review.employee.lastName
              );
              const colorIdx =
                review.employee.firstName.charCodeAt(0) %
                avatarColors.length;
              return (
                <div
                  key={review.id}
                  className={cn(
                    "rounded-2xl p-4",
                    "bg-[var(--color-surface)] border border-[var(--color-border)]",
                    "border-l-4 border-l-[var(--color-accent)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                          avatarColors[colorIdx]
                        )}
                      >
                        {empInitials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {review.employee.firstName}{" "}
                          {review.employee.lastName}
                        </p>
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                            typeConfig[review.type] || ""
                          )}
                        >
                          {review.type}
                        </span>
                      </div>
                    </div>
                    <SubmitReviewDialog
                      review={{
                        id: review.id,
                        employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                        type: review.type,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Cycles */}
      {cycles.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardCheck className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">
            No review cycles yet.{" "}
            {isAdmin && "Create one to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {cycles.map((cycle) => {
            const submitted = cycle.reviews.filter(
              (r) => r.status === "SUBMITTED"
            ).length;
            const pending = cycle.reviews.length - submitted;
            const progressPercent =
              cycle.reviews.length > 0
                ? Math.round(
                    (submitted / cycle.reviews.length) * 100
                  )
                : 0;
            const cycleCfg =
              cycleStatusConfig[cycle.status] ||
              cycleStatusConfig.DRAFT;

            return (
              <div
                key={cycle.id}
                className={cn(
                  "rounded-2xl overflow-hidden gradient-border",
                  "bg-[var(--color-surface)] border border-[var(--color-border)]"
                )}
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className="h-5 w-5 text-[var(--color-accent)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {cycle.name}
                        </h2>
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
                            cycleCfg.color
                          )}
                        >
                          {cycleCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(cycle.startDate)} —{" "}
                        {formatDate(cycle.endDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <AddReviewDialog
                          cycleId={cycle.id}
                          employees={employeeList}
                        />
                      )}
                      {isAdmin && (
                        <CycleActions
                          cycleId={cycle.id}
                          status={cycle.status}
                        />
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {cycle.reviews.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          Progress
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {submitted}/{cycle.reviews.length} completed (
                          {progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[var(--color-background)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-purple-500 transition-all"
                          style={{
                            width: `${progressPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Pending
                        </span>
                      </div>
                      <p className="text-xl font-bold text-[var(--color-text-primary)]">
                        {pending}
                      </p>
                    </div>
                    <div className="rounded-lg p-3 bg-[var(--color-background)] border border-[var(--color-border)] text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">
                          Submitted
                        </span>
                      </div>
                      <p className="text-xl font-bold text-[var(--color-text-primary)]">
                        {submitted}
                      </p>
                    </div>
                  </div>

                  {/* Reviews table */}
                  {cycle.reviews.length > 0 && (
                    <>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Reviews
                        </h3>
                      </div>
                      <div className="hidden md:block">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[var(--color-border)]">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Employee
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Reviewer
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Type
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Rating
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Status
                              </th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {cycle.reviews.map((review) => {
                              const cfg =
                                statusConfig[review.status] ||
                                statusConfig.PENDING;
                              const StatusIcon = cfg.icon;
                              const empInitials = getInitials(
                                review.employee.firstName,
                                review.employee.lastName
                              );
                              const colorIdx =
                                review.employee.firstName.charCodeAt(
                                  0
                                ) % avatarColors.length;
                              const canSubmit =
                                review.status === "PENDING" &&
                                (review.reviewerId ===
                                  currentEmployeeId ||
                                  isAdmin) &&
                                cycle.status === "ACTIVE";
                              const canView =
                                review.status === "SUBMITTED" &&
                                (isAdmin ||
                                  review.reviewerId ===
                                    currentEmployeeId ||
                                  review.employeeId ===
                                    currentEmployeeId);

                              return (
                                <tr
                                  key={review.id}
                                  className="hover:bg-[var(--color-surface-hover)] transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={cn(
                                          "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                                          avatarColors[
                                            colorIdx
                                          ]
                                        )}
                                      >
                                        {empInitials}
                                      </div>
                                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                        {
                                          review.employee
                                            .firstName
                                        }{" "}
                                        {
                                          review.employee
                                            .lastName
                                        }
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                                    {review.reviewer.firstName}{" "}
                                    {review.reviewer.lastName}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={cn(
                                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                                        typeConfig[
                                          review.type
                                        ] || ""
                                      )}
                                    >
                                      {review.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {review.rating ? (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                                        <span className="text-sm text-[var(--color-text-primary)]">
                                          {review.rating}/5
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-[var(--color-text-muted)]">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                        cfg.bg,
                                        cfg.color
                                      )}
                                    >
                                      <StatusIcon className="h-3 w-3" />
                                      {review.status}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {canSubmit && (
                                      <SubmitReviewDialog
                                        review={{
                                          id: review.id,
                                          employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                                          type: review.type,
                                        }}
                                      />
                                    )}
                                    {canView && (
                                      <ViewReviewDialog
                                        review={{
                                          employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                                          reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
                                          type: review.type,
                                          rating: review.rating,
                                          strengths:
                                            review.strengths,
                                          improvements:
                                            review.improvements,
                                          goals: review.goals,
                                        }}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile view */}
                      <div className="md:hidden divide-y divide-[var(--color-border)]">
                        {cycle.reviews.map((review) => {
                          const cfg =
                            statusConfig[review.status] ||
                            statusConfig.PENDING;
                          const StatusIcon = cfg.icon;
                          const empInitials = getInitials(
                            review.employee.firstName,
                            review.employee.lastName
                          );
                          const colorIdx =
                            review.employee.firstName.charCodeAt(
                              0
                            ) % avatarColors.length;
                          const canSubmit =
                            review.status === "PENDING" &&
                            (review.reviewerId ===
                              currentEmployeeId ||
                              isAdmin) &&
                            cycle.status === "ACTIVE";
                          const canView =
                            review.status === "SUBMITTED" &&
                            (isAdmin ||
                              review.reviewerId ===
                                currentEmployeeId ||
                              review.employeeId ===
                                currentEmployeeId);

                          return (
                            <div key={review.id} className="py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                                      avatarColors[colorIdx]
                                    )}
                                  >
                                    {empInitials}
                                  </div>
                                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {review.employee.firstName}{" "}
                                    {review.employee.lastName}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                    cfg.bg,
                                    cfg.color
                                  )}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {review.status}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                  <span>
                                    By:{" "}
                                    {review.reviewer.firstName}{" "}
                                    {review.reviewer.lastName}
                                  </span>
                                  <span
                                    className={cn(
                                      "inline-flex px-1.5 py-0.5 rounded-full font-medium",
                                      typeConfig[
                                        review.type
                                      ] || ""
                                    )}
                                  >
                                    {review.type}
                                  </span>
                                  {review.rating && (
                                    <span className="flex items-center gap-0.5">
                                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                      {review.rating}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {canSubmit && (
                                    <SubmitReviewDialog
                                      review={{
                                        id: review.id,
                                        employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                                        type: review.type,
                                      }}
                                    />
                                  )}
                                  {canView && (
                                    <ViewReviewDialog
                                      review={{
                                        employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                                        reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
                                        type: review.type,
                                        rating: review.rating,
                                        strengths:
                                          review.strengths,
                                        improvements:
                                          review.improvements,
                                        goals: review.goals,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {cycle.reviews.length === 0 && (
                    <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
                      No reviews assigned yet.{" "}
                      {isAdmin && "Add reviews to this cycle."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
