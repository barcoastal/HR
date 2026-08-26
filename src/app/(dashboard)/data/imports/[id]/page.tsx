import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { getImportBatch } from "@/lib/actions/imports";
import { ImportBatchView } from "@/components/data/import-batch-view";

export const dynamic = "force-dynamic";

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getImportBatch(id);
  if (!detail) notFound();
  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4">
      <ImportBatchView detail={detail} />
    </div>
  );
}
