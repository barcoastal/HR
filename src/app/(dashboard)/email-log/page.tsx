import { PageHeader } from "@/components/ui/page-header";
import { EmailLogTable } from "@/components/email-log/email-log-table";
import { Icon } from "@/components/ui/icon";
import { requireAdmin } from "@/lib/auth-helpers";
import { getEmailDeliveryLog, getEmailDeliveryStats } from "@/lib/actions/email-deliveries";

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const requestedPage = Number.parseInt(filters.page || "1", 10);
  const [deliveryPage, stats] = await Promise.all([
    getEmailDeliveryLog({
      query: filters.q,
      status: filters.status,
      page: Number.isFinite(requestedPage) ? requestedPage : 1,
    }),
    getEmailDeliveryStats(),
  ]);
  const summary = [
    { label: "All recorded emails", value: stats.total, icon: "mail" },
    { label: "Delivered", value: stats.delivered, icon: "mark_email_read" },
    { label: "Provider accepted", value: stats.accepted, icon: "send" },
    { label: "Pending", value: stats.pending, icon: "schedule" },
    { label: "Needs attention", value: stats.issues, icon: "error" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <PageHeader
        title="Email Log"
        description="Organization-wide history of every automated email recorded by Coastal HR, including failures and bounces."
      />

      <section aria-label="Email delivery summary" className="mb-5 flex flex-wrap rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {summary.map((item, index) => (
          <div key={item.label} className="flex min-w-[150px] flex-1 items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <Icon name={item.icon} size={18} />
            </span>
            <div>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">{item.value}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
            </div>
            {index < summary.length - 1 && <span aria-hidden className="ml-auto hidden h-9 w-px bg-[var(--color-border)] lg:block" />}
          </div>
        ))}
      </section>

      <p className="mb-3 text-xs text-[var(--color-text-muted)]">
        Provider accepted means Resend accepted the message. Delivered is confirmed by the signed delivery webhook.
      </p>
      <EmailLogTable
        deliveries={deliveryPage.deliveries}
        total={deliveryPage.total}
        page={deliveryPage.page}
        pageSize={deliveryPage.pageSize}
        pageCount={deliveryPage.pageCount}
        query={filters.q}
        status={filters.status}
      />
    </div>
  );
}
