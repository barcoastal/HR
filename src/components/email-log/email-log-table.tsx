import Link from "next/link";
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

const STATUSES = ["DELIVERED", "SENT", "QUEUED", "DELAYED", "FAILED", "BOUNCED", "SUPPRESSED", "COMPLAINED"];

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}

function contextLabel(value: string | null): string {
  if (!value) return "Automated email";
  const labels: Record<string, string> = {
    INTERVIEW_INVITATION: "Interview invitation",
    PRE_ADVERSE_ACTION: "Pre-adverse action",
    ADVERSE_ACTION: "Adverse action",
    EMAIL_TEMPLATE_TEST: "Email template test",
    EMERGENCY_ALERT: "Emergency alert",
    EMERGENCY_ALERT_TEST: "Emergency alert test",
  };
  return labels[value] || titleCase(value);
}

function eventTime(delivery: EmailDeliverySummary): string {
  const value = delivery.deliveredAt || delivery.failedAt || delivery.sentAt || delivery.createdAt;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pageHref(page: number, query?: string, status?: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/email-log?${search}` : "/email-log";
}

export function EmailLogTable({
  deliveries,
  total,
  page,
  pageSize,
  pageCount,
  query,
  status,
}: {
  deliveries: EmailDeliverySummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query?: string;
  status?: string;
}) {
  const firstRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(total, page * pageSize);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">Search email</span>
          <span className="relative block">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Recipient, subject, or email type"
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </span>
        </label>
        <label className="sm:w-48">
          <span className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">Delivery status</span>
          <select
            name="status"
            defaultValue={status || ""}
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className="h-10 rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]">
            Filter log
          </button>
          {(query || status) && (
            <Link href="/email-log" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
              Clear
            </Link>
          )}
        </div>
      </form>

      {deliveries.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <Icon name="outgoing_mail" size={32} className="mx-auto text-[var(--color-text-muted)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No matching emails</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">New automated messages appear here as soon as they are queued.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="bg-[var(--color-background)] text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Message</th>
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Initiated by</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/70">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="align-top hover:bg-[var(--color-surface-hover)]/50">
                  <td className="max-w-md px-5 py-4">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{delivery.subject}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{contextLabel(delivery.contextType)}</p>
                    {delivery.error && <p className="mt-1.5 text-xs text-red-700">{delivery.error}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-primary)]">{delivery.recipient}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{delivery.senderName || "System"}</td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[delivery.status] || "bg-[var(--color-background)] text-[var(--color-text-muted)]")}>{titleCase(delivery.status)}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--color-text-muted)]">{eventTime(delivery)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          Showing {firstRecord.toLocaleString()}–{lastRecord.toLocaleString()} of {total.toLocaleString()} organization-wide emails
        </p>
        {pageCount > 1 && (
          <nav aria-label="Email log pages" className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1, query, status)} className="inline-flex h-9 items-center rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
                Previous
              </Link>
            ) : (
              <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-muted)] opacity-50">Previous</span>
            )}
            <span className="px-2 text-xs text-[var(--color-text-muted)]">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link href={pageHref(page + 1, query, status)} className="inline-flex h-9 items-center rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
                Next
              </Link>
            ) : (
              <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-muted)] opacity-50">Next</span>
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
