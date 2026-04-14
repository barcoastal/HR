import { requireAuth } from "@/lib/auth-helpers";
import { getMyDocuments } from "@/lib/actions/my-documents";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  stored: { label: "On file", className: "bg-gray-500/10 text-gray-600" },
  PENDING: { label: "Waiting for you", className: "bg-amber-500/10 text-amber-700" },
  VIEWED: { label: "Waiting for you", className: "bg-amber-500/10 text-amber-700" },
  AWAITING_COUNTERSIGN: { label: "Awaiting countersign", className: "bg-purple-500/10 text-purple-700" },
  SIGNED: { label: "Signed", className: "bg-emerald-500/10 text-emerald-700" },
  VOIDED: { label: "Voided", className: "bg-gray-400/10 text-gray-500" },
};

export default async function MyDocumentsPage() {
  const session = await requireAuth();
  if (!session.user.employeeId) redirect("/");

  const documents = await getMyDocuments();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader title="My Documents" description="All documents on file and anything we've sent you to sign" />

      {documents.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="folder_open" size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">You don&apos;t have any documents yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          {documents.map((doc, i) => {
            const badge = STATUS_BADGE[doc.status] ?? { label: doc.status, className: "bg-gray-500/10 text-gray-600" };
            return (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg)] transition-colors ${i > 0 ? "border-t border-[var(--color-border)]" : ""}`}
              >
                <div className="h-10 w-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                  <Icon name="picture_as_pdf" size={18} className="text-[var(--color-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {formatDate(doc.createdAt)}
                    {doc.category && <> · {doc.category.toLowerCase()}</>}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
                <Icon name="open_in_new" size={16} className="text-[var(--color-text-muted)]" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
