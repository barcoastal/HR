"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { EmailDeliverySummary } from "@/lib/actions/email-deliveries";

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: "bg-emerald-500/10 text-emerald-700",
  SENT: "bg-blue-500/10 text-blue-700",
  QUEUED: "bg-amber-500/10 text-amber-700",
  DELAYED: "bg-amber-500/10 text-amber-700",
  SUPPRESSED: "bg-slate-500/10 text-slate-700",
  FAILED: "bg-red-500/10 text-red-700",
  BOUNCED: "bg-red-500/10 text-red-700",
  COMPLAINED: "bg-red-500/10 text-red-700",
};

function statusLabel(status: string): string {
  if (status === "SENT") return "Sent";
  if (status === "DELIVERED") return "Delivered";
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}

function timestamp(delivery: EmailDeliverySummary): string {
  const value = delivery.deliveredAt || delivery.sentAt || delivery.createdAt;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function EmailDeliveryActivity({ deliveries }: { deliveries: EmailDeliverySummary[] }) {
  const router = useRouter();

  return (
    <section id="email-delivery-activity" className="scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Automated email delivery</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Sent means the provider accepted the email. Delivered is confirmed by the signed Resend webhook.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
        >
          <Icon name="refresh" size={14} />
          Refresh status
        </button>
      </div>

      {deliveries.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Icon name="outgoing_mail" size={28} className="mx-auto text-[var(--color-text-muted)]" />
          <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">No automated emails recorded yet</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">New emails will appear here as they are queued.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]/60">
          {deliveries.map((delivery) => {
            const failed = ["FAILED", "BOUNCED", "COMPLAINED"].includes(delivery.status);
            return (
              <div key={delivery.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{delivery.subject}</p>
                    <span className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      STATUS_STYLE[delivery.status] || "bg-[var(--color-background)] text-[var(--color-text-muted)]"
                    )}>
                      {statusLabel(delivery.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                    To {delivery.recipient}{delivery.senderName ? ` · initiated by ${delivery.senderName}` : " · automated"}
                  </p>
                  {delivery.error && (
                    <p className={cn("mt-1 text-xs", failed ? "text-red-700" : "text-[var(--color-text-muted)]")}>
                      {delivery.error}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-[var(--color-text-muted)]">{timestamp(delivery)}</time>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
