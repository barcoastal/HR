import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { ImportBatchSummary } from "@/lib/actions/imports";

const STATUS: Record<ImportBatchSummary["status"], { label: string; className: string }> = {
  REVIEWING: { label: "Reviewing", className: "bg-amber-500/10 text-amber-600" },
  IMPORTED: { label: "Imported", className: "bg-emerald-500/10 text-emerald-600" },
  DISCARDED: { label: "Discarded", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" },
  UNDONE: { label: "Undone", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" },
};

export function ImportsList({ batches }: { batches: ImportBatchSummary[] }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
        <Icon name="upload_file" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">No imports yet</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Upload a CSV or Excel file of people to start a review.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
          <tr>
            <th className="px-4 py-2 text-left font-medium">File</th>
            <th className="px-4 py-2 text-left font-medium">Uploaded by</th>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-right font-medium">Rows</th>
            <th className="px-4 py-2 text-right font-medium">New</th>
            <th className="px-4 py-2 text-right font-medium">Updates</th>
            <th className="px-4 py-2 text-right font-medium">Merged</th>
            <th className="px-4 py-2 text-right font-medium">Skipped</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
              <td className="px-4 py-3">
                <Link
                  href={`/data/imports/${b.id}`}
                  className="font-medium text-[var(--color-text-primary)] hover:underline inline-flex items-center gap-2"
                >
                  <Icon name="table_chart" size={16} className="text-[var(--color-text-muted)]" />
                  {b.fileName}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{b.uploadedBy}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(b.createdAt)}</td>
              <td className="px-4 py-3 text-right">{b.rowCount}</td>
              <td className="px-4 py-3 text-right">{b.counts.create}</td>
              <td className="px-4 py-3 text-right">{b.counts.update}</td>
              <td className="px-4 py-3 text-right">{b.counts.mergedAway}</td>
              <td className="px-4 py-3 text-right">{b.counts.skipped + b.counts.invalid}</td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium", STATUS[b.status].className)}>
                  {STATUS[b.status].label}
                </span>
                {b.status === "UNDONE" && b.undoneAt && (
                  <span className="block mt-1 text-[11px] text-[var(--color-text-muted)]">on {formatDate(b.undoneAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
