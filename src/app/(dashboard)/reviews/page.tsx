import { cn, getInitials, formatDate } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Calendar,
  Star,
  FileText,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CreateCycleDialog } from "@/components/reviews/create-cycle-dialog";
import { AddReviewDialog } from "@/components/reviews/add-review-dialog";
import { SubmitReviewDialog } from "@/components/reviews/submit-review-dialog";
import { ViewReviewDialog } from "@/components/reviews/view-review-dialog";
import { CycleActions } from "@/components/reviews/cycle-actions";
import { GenerateReviewsDialog } from "@/components/reviews/generate-reviews-dialog";

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  SUBMITTED: { color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  PENDING: { color: "text-[var(--color-text-muted)]", bg: "bg-[var(--color-surface-hover)]", icon: Clock },
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
const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export default async function ReviewsPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManager = role === "MANAGER";
  const currentEmployeeId = session.user?.employeeId;

  const [cycles, employees, departments] = await Promise.all([
    db.reviewCycle.findMany({
      include: {
        reviews: {
          include: { employee: { include: { department: true } }, reviewer: true },
          orderBy: { createdAt: "desc" },
          ...(!isAdmin && !isManager && currentEmployeeId
            ? {
                where: {
                  OR: [
                    { employeeId: currentEmployeeId },
                    { reviewerId: currentEmployeeId },
                  ],
                },
              }
            : !isAdmin && isManager && currentEmployeeId
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
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
    db.department.findMany({
      include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const employeeList = employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }));
  const departmentList = departments.map((d) => ({ id: d.id, name: d.name, employeeCount: d._count.employees }));

  // Stats
  const allReviews = cycles.flatMap((c) => c.reviews);
  const submittedReviews = allReviews.filter((r) => r.status === "SUBMITTED").length;
  const pendingReviews = allReviews.filter((r) => r.status === "PENDING").length;
  const avgRating =
    allReviews.filter((r) => r.rating).length > 0
      ? (allReviews.filter((r) => r.rating).reduce((acc, r) => acc + (r.rating || 0), 0) / allReviews.filter((r) => r.rating).length).toFixed(1)
      : "—";

  // My pending reviews
  const myPendingReviews = currentEmployeeId
    ? allReviews.filter(
        (r) => r.reviewerId === currentEmployeeId && r.status === "PENDING" && cycles.find((c) => c.id === r.cycleId)?.status === "ACTIVE"
      )
    : [];

  // For employees: group reviews by employee to show self + manager side by side
  const myCompletedPairs = currentEmployeeId
    ? cycles
        .filter((c) => c.status === "ACTIVE" || c.status === "CLOSED")
        .flatMap((c) => {
          const myReviews = c.reviews.filter((r) => r.employeeId === currentEmployeeId);
          const selfReview = myReviews.find((r) => r.type === "SELF");
          const managerReview = myReviews.find((r) => r.type === "MANAGER");
          if (!selfReview && !managerReview) return [];
          const bothSubmitted = selfReview?.status === "SUBMITTED" && managerReview?.status === "SUBMITTED";
          return [{ cycleName: c.name, cycleId: c.id, selfReview, managerReview, bothSubmitted }];
        })
    : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Reviews" description="Performance review cycles and submissions" />
        {isAdmin && <CreateCycleDialog departments={departmentList} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Cycles" value={cycles.length} icon={<ClipboardCheck className="h-5 w-5" />} color="blue" />
        <StatCard title="Active Cycles" value={cycles.filter((c) => c.status === "ACTIVE").length} icon={<Calendar className="h-5 w-5" />} color="emerald" />
        <StatCard title="Submitted" value={submittedReviews} icon={<FileText className="h-5 w-5" />} color="purple" />
        <StatCard title="Avg Rating" value={avgRating} icon={<Star className="h-5 w-5" />} color="amber" animate={false} />
      </div>

      {/* My pending reviews */}
      {myPendingReviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Your Pending Reviews</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myPendingReviews.map((review) => {
              const empInitials = getInitials(review.employee.firstName, review.employee.lastName);
              const colorIdx = review.employee.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <div key={review.id} className={cn("rounded-2xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]", "border-l-4 border-l-[var(--color-accent)]")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{empInitials}</div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{review.employee.firstName} {review.employee.lastName}</p>
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", typeConfig[review.type] || "")}>{review.type}</span>
                      </div>
                    </div>
                    <SubmitReviewDialog review={{ id: review.id, employeeName: `${review.employee.firstName} ${review.employee.lastName}`, type: review.type }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My completed reviews — employee sees self + manager side by side */}
      {!isAdmin && myCompletedPairs.some((p) => p.bothSubmitted) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Your Review Results</h2>
          <div className="space-y-4">
            {myCompletedPairs.filter((p) => p.bothSubmitted).map((pair) => (
              <div key={pair.cycleId} className={cn("rounded-2xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <div className="px-5 py-3 border-b border-[var(--color-border)]">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{pair.cycleName}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]">
                  {/* Self Review */}
                  {pair.selfReview && (
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", typeConfig.SELF)}>Self Review</span>
                        {pair.selfReview.rating && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={cn("h-3.5 w-3.5", n <= pair.selfReview!.rating! ? "text-amber-400 fill-amber-400" : "text-[var(--color-border)]")} />
                            ))}
                          </div>
                        )}
                      </div>
                      {pair.selfReview.strengths && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Strengths</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.selfReview.strengths}</p>
                        </div>
                      )}
                      {pair.selfReview.improvements && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Areas for Improvement</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.selfReview.improvements}</p>
                        </div>
                      )}
                      {pair.selfReview.goals && (
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Goals</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.selfReview.goals}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Manager Review */}
                  {pair.managerReview && (
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", typeConfig.MANAGER)}>Manager Review</span>
                        <span className="text-xs text-[var(--color-text-muted)]">by {pair.managerReview.reviewer.firstName} {pair.managerReview.reviewer.lastName}</span>
                        {pair.managerReview.rating && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={cn("h-3.5 w-3.5", n <= pair.managerReview!.rating! ? "text-amber-400 fill-amber-400" : "text-[var(--color-border)]")} />
                            ))}
                          </div>
                        )}
                      </div>
                      {pair.managerReview.strengths && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Strengths</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.managerReview.strengths}</p>
                        </div>
                      )}
                      {pair.managerReview.improvements && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Areas for Improvement</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.managerReview.improvements}</p>
                        </div>
                      )}
                      {pair.managerReview.goals && (
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">Goals</p>
                          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{pair.managerReview.goals}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Cycles */}
      {cycles.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardCheck className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">No review cycles yet. {isAdmin && "Create one to get started."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {cycles.map((cycle) => {
            const submitted = cycle.reviews.filter((r) => r.status === "SUBMITTED").length;
            const pending = cycle.reviews.length - submitted;
            const progressPercent = cycle.reviews.length > 0 ? Math.round((submitted / cycle.reviews.length) * 100) : 0;
            const cycleCfg = cycleStatusConfig[cycle.status] || cycleStatusConfig.DRAFT;

            // Group reviews by employee for admin view
            const reviewsByEmployee = isAdmin
              ? cycle.reviews.reduce((acc, review) => {
                  const key = review.employeeId;
                  if (!acc[key]) acc[key] = { employee: review.employee, reviews: [] };
                  acc[key].reviews.push(review);
                  return acc;
                }, {} as Record<string, { employee: typeof cycle.reviews[0]["employee"]; reviews: typeof cycle.reviews }>)
              : {};

            return (
              <div key={cycle.id} className={cn("rounded-2xl overflow-hidden gradient-border", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className="h-5 w-5 text-[var(--color-accent)]" />
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{cycle.name}</h2>
                        <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium", cycleCfg.color)}>{cycleCfg.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <GenerateReviewsDialog cycleId={cycle.id} departments={departmentList} />
                        <AddReviewDialog cycleId={cycle.id} employees={employeeList} />
                        <CycleActions cycleId={cycle.id} status={cycle.status} />
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {cycle.reviews.length > 0 && (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">Progress</span>
                        <span className="text-sm text-[var(--color-text-muted)]">{submitted}/{cycle.reviews.length} completed ({progressPercent}%)</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[var(--color-background)] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-purple-500 transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Admin: Employee-grouped view */}
                  {isAdmin && Object.keys(reviewsByEmployee).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Reviews by Employee</h3>
                      </div>
                      {Object.values(reviewsByEmployee).map(({ employee: emp, reviews }) => {
                        const empInitials = getInitials(emp.firstName, emp.lastName);
                        const colorIdx = emp.firstName.charCodeAt(0) % avatarColors.length;
                        const selfR = reviews.find((r) => r.type === "SELF");
                        const mgrR = reviews.find((r) => r.type === "MANAGER");
                        const peerRs = reviews.filter((r) => r.type === "PEER");
                        const allDone = reviews.every((r) => r.status === "SUBMITTED");

                        return (
                          <div key={emp.id} className={cn("rounded-xl p-4", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
                            <div className="flex items-center gap-3 mb-3">
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{empInitials}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">{emp.jobTitle} {emp.department ? `· ${emp.department.name}` : ""}</p>
                              </div>
                              {allDone && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />Complete
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selfR && (
                                <ReviewPill review={selfR} type="SELF" currentEmployeeId={currentEmployeeId} isAdmin={isAdmin} cycleActive={cycle.status === "ACTIVE"} />
                              )}
                              {mgrR && (
                                <ReviewPill review={mgrR} type="MANAGER" currentEmployeeId={currentEmployeeId} isAdmin={isAdmin} cycleActive={cycle.status === "ACTIVE"} />
                              )}
                              {peerRs.map((pr) => (
                                <ReviewPill key={pr.id} review={pr} type="PEER" currentEmployeeId={currentEmployeeId} isAdmin={isAdmin} cycleActive={cycle.status === "ACTIVE"} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Non-admin: simple list */}
                  {!isAdmin && cycle.reviews.length > 0 && (
                    <div className="space-y-2">
                      {cycle.reviews.map((review) => {
                        const cfg = statusConfig[review.status] || statusConfig.PENDING;
                        const StatusIcon = cfg.icon;
                        const canSubmit = review.status === "PENDING" && review.reviewerId === currentEmployeeId && cycle.status === "ACTIVE";
                        const canView = review.status === "SUBMITTED" && (review.reviewerId === currentEmployeeId || review.employeeId === currentEmployeeId);

                        return (
                          <div key={review.id} className={cn("rounded-xl p-3 flex items-center justify-between", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
                            <div className="flex items-center gap-3">
                              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[review.employee.firstName.charCodeAt(0) % avatarColors.length])}>
                                {getInitials(review.employee.firstName, review.employee.lastName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{review.employee.firstName} {review.employee.lastName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={cn("inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium", typeConfig[review.type] || "")}>{review.type}</span>
                                  <div className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
                                    <StatusIcon className="h-3 w-3" />{review.status}
                                  </div>
                                  {review.rating && (
                                    <span className="flex items-center gap-0.5 text-xs"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{review.rating}/5</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div>
                              {canSubmit && <SubmitReviewDialog review={{ id: review.id, employeeName: `${review.employee.firstName} ${review.employee.lastName}`, type: review.type }} />}
                              {canView && (
                                <ViewReviewDialog review={{
                                  employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
                                  reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
                                  type: review.type,
                                  rating: review.rating,
                                  strengths: review.strengths,
                                  improvements: review.improvements,
                                  goals: review.goals,
                                }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {cycle.reviews.length === 0 && (
                    <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
                      No reviews assigned yet. {isAdmin && "Use \"Generate\" to auto-create reviews for departments, or add manually."}
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

// Helper component for admin view
function ReviewPill({
  review,
  type,
  currentEmployeeId,
  isAdmin,
  cycleActive,
}: {
  review: { id: string; status: string; rating: number | null; type: string; reviewerId: string; employeeId: string; employee: { firstName: string; lastName: string }; reviewer: { firstName: string; lastName: string }; strengths: string | null; improvements: string | null; goals: string | null };
  type: string;
  currentEmployeeId?: string | null;
  isAdmin: boolean;
  cycleActive: boolean;
}) {
  const isSubmitted = review.status === "SUBMITTED";
  const canSubmit = !isSubmitted && (review.reviewerId === currentEmployeeId || isAdmin) && cycleActive;
  const canView = isSubmitted;

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border",
      isSubmitted ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[var(--color-surface)] border-[var(--color-border)]"
    )}>
      <span className={cn("inline-flex px-1.5 py-0.5 rounded-full font-medium", typeConfig[type] || "")}>{type}</span>
      <span className="text-[var(--color-text-muted)]">
        {type === "SELF" ? "by self" : `by ${review.reviewer.firstName}`}
      </span>
      {isSubmitted && review.rating && (
        <span className="flex items-center gap-0.5">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />{review.rating}
        </span>
      )}
      {isSubmitted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
      {!isSubmitted && <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />}
      {canSubmit && (
        <SubmitReviewDialog review={{ id: review.id, employeeName: `${review.employee.firstName} ${review.employee.lastName}`, type: review.type }} />
      )}
      {canView && (
        <ViewReviewDialog review={{
          employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
          reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
          type: review.type,
          rating: review.rating,
          strengths: review.strengths,
          improvements: review.improvements,
          goals: review.goals,
        }} />
      )}
    </div>
  );
}
