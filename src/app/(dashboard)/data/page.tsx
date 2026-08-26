import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { listImportBatches } from "@/lib/actions/imports";
import { PageHeader } from "@/components/ui/page-header";
import { ImportsList } from "@/components/data/imports-list";
import { NewImportDialog } from "@/components/data/new-import-dialog";
import { ExportPlaceholder } from "@/components/data/export-placeholder";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "import", label: "Import" },
  { id: "export", label: "Export" },
] as const;

export default async function DataPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const active = tab === "export" ? "export" : "import";
  const batches = active === "import" ? await listImportBatches() : [];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="Import & Export"
        description="Bring people in from a spreadsheet, review duplicates before anything is saved, and export data out of the system."
        action={active === "import" ? <NewImportDialog /> : undefined}
      />
      <nav aria-label="Import & Export sections" className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => {
          const selected = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/data?tab=${t.id}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                selected
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t.label}
              {selected && (
                <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </nav>
      {active === "import" ? <ImportsList batches={batches} /> : <ExportPlaceholder />}
    </div>
  );
}
