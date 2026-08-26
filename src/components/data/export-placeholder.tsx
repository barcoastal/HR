import { Icon } from "@/components/ui/icon";

export function ExportPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
      <Icon name="download" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
      <p className="text-sm font-medium text-[var(--color-text-primary)]">Export is next</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
        You&apos;ll pick what to export (people, candidates, departments, time off, reviews…), choose columns and filters, and
        download CSV or Excel. Not built yet.
      </p>
    </div>
  );
}
