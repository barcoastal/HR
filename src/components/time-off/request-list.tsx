"use client";

import { cn } from "@/lib/utils";
import { getInitials, formatDate } from "@/lib/utils";
import { Check, X, Clock, Ban } from "lucide-react";
import { approveTimeOffRequest, denyTimeOffRequest, cancelTimeOffRequest } from "@/lib/actions/time-off";
import { useRouter } from "next/navigation";

type Request = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  reason: string | null;
  status: string;
  createdAt: Date;
  employee: { id: string; firstName: string; lastName: string; jobTitle: string };
  policy: { name: string };
  approver: { firstName: string; lastName: string } | null;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500/15 text-yellow-500", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-emerald-500/15 text-emerald-500", icon: Check },
  DENIED: { label: "Denied", color: "bg-red-500/15 text-red-500", icon: X },
  CANCELLED: { label: "Cancelled", color: "bg-gray-500/15 text-gray-400", icon: Ban },
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function RequestList({
  requests,
  currentEmployeeId,
  canApprove,
}: {
  requests: Request[];
  currentEmployeeId: string;
  canApprove: boolean;
}) {
  const router = useRouter();

  async function handleApprove(id: string) {
    await approveTimeOffRequest(id, currentEmployeeId);
    router.refresh();
  }

  async function handleDeny(id: string) {
    await denyTimeOffRequest(id, currentEmployeeId);
    router.refresh();
  }

  async function handleCancel(id: string) {
    await cancelTimeOffRequest(id);
    router.refresh();
  }

  if (requests.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No time off requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const cfg = statusConfig[req.status] || statusConfig.PENDING;
        const StatusIcon = cfg.icon;
        const initials = getInitials(req.employee.firstName, req.employee.lastName);
        const colorIdx = req.employee.firstName.charCodeAt(0) % avatarColors.length;
        const isOwn = req.employee.id === currentEmployeeId;

        return (
          <div key={req.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
            <div className="flex items-start gap-3">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColors[colorIdx])}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[var(--color-text-primary)]">{req.employee.firstName} {req.employee.lastName}</p>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
                    <StatusIcon className="h-3 w-3" />{cfg.label}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {req.policy.name} · {req.daysCount} day{req.daysCount !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] mt-1">
                  {formatDate(req.startDate)} — {formatDate(req.endDate)}
                </p>
                {req.reason && <p className="text-sm text-[var(--color-text-muted)] mt-1 italic">{req.reason}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {req.status === "PENDING" && canApprove && !isOwn && (
                  <>
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeny(req.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Deny"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {req.status === "PENDING" && isOwn && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
