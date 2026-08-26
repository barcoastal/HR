import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { listImportBatches } from "@/lib/actions/imports";
import { getExportOptions } from "@/lib/actions/exports";
import { PageHeader } from "@/components/ui/page-header";
import { ImportsList } from "@/components/data/imports-list";
import { NewImportDialog } from "@/components/data/new-import-dialog";
import { ExportBuilder } from "@/components/data/export-builder";
import { SystemDuplicatesView } from "@/components/data/system-duplicates-view";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "import", label: "Import" },
  { id: "export", label: "Export" },
  { id: "duplicates", label: "Duplicates" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function activeTab(tab: string | undefined): TabId {
  return TABS.some((t) => t.id === tab) ? (tab as TabId) : "import";
}

export default async function DataPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const active = activeTab(tab);
  const batches = active === "import" ? await listImportBatches() : [];
  const exportOptions = active === "export" ? await getExportOptions() : null;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="Import & Export"
        description="Bring people in from a spreadsheet, review duplicates before anything is saved, export data out of the system, and clean up look-alike records."
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
      {active === "duplicates" && <SystemDuplicatesView />}
      {active === "export" && exportOptions && <ExportBuilder options={exportOptions} />}
      {active === "import" && <ImportsList batches={batches} />}
    </div>
  );
}
