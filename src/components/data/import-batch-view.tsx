"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { discardImportBatch, saveImportMapping, type ImportBatchDetail } from "@/lib/actions/imports";
import type { ColumnMapping } from "@/lib/import-export/types";
import { ImportSteps, type ImportStepId } from "./import-steps";
import { MappingStep } from "./mapping-step";
import { ImportStep } from "./import-step";
import { ReviewStep } from "./review-step";

function mappingIsComplete(m: ColumnMapping | null) {
  return !!m && m.includes("firstName") && m.includes("lastName");
}

function sameMapping(a: ColumnMapping | null, b: ColumnMapping | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const READ_ONLY_LABEL: Record<string, string> = { IMPORTED: "Imported", UNDONE: "Undone", DISCARDED: "Discarded" };

export function ImportBatchView({ detail }: { detail: ImportBatchDetail }) {
  const router = useRouter();
  const readOnly = detail.batch.status !== "REVIEWING";
  const canReview = mappingIsComplete(detail.batch.mapping);
  const [step, setStep] = useState<ImportStepId>(
    detail.batch.status === "IMPORTED" || detail.batch.status === "UNDONE" ? "import" : canReview ? "review" : "map",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasDecisions =
    detail.groups.some((g) => g.status !== "PENDING") ||
    detail.rows.some((r) => r.action === "MERGED_AWAY" || r.action === "UPDATE" || r.skipReason === "user");

  function run(fn: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleSaveMapping(mapping: ColumnMapping) {
    // Nothing changed — no need to re-read every row on the server.
    if (sameMapping(mapping, detail.batch.mapping)) {
      setStep("review");
      return;
    }
    if (
      hasDecisions &&
      !confirm("Changing the mapping re-reads every row and clears all merge / keep-separate decisions. Continue?")
    ) {
      return;
    }
    run(() => saveImportMapping(detail.batch.id, mapping), () => setStep("review"));
  }

  function handleDiscard() {
    if (!confirm("Discard this import? Nothing has been saved to the system; the batch stays in history as Discarded.")) return;
    run(() => discardImportBatch(detail.batch.id), () => router.push("/data"));
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/data" className="text-xs text-[var(--color-text-muted)] hover:underline inline-flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> All imports
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1 inline-flex items-center gap-2">
            <Icon name="table_chart" size={22} className="text-[var(--color-text-muted)]" /> {detail.batch.fileName}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {detail.batch.rowCount} rows · uploaded by {detail.batch.uploadedBy} on {formatDate(detail.batch.createdAt)}
            {readOnly && <span className="ml-2 font-medium">· {READ_ONLY_LABEL[detail.batch.status] ?? detail.batch.status}</span>}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleDiscard}
            disabled={pending}
            className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
          >
            Discard import
          </button>
        )}
      </div>

      <ImportSteps current={step} onSelect={setStep} canReview={canReview} />
      {error && <p className="mb-4 text-xs text-red-500">{error}</p>}
      {pending && (
        <p className="mb-4 text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1">
          <Icon name="progress_activity" size={14} className="animate-material-spin" /> Working…
        </p>
      )}

      {step === "map" && (
        <MappingStep
          headers={detail.batch.headers}
          mapping={detail.batch.mapping}
          sampleRows={detail.rows.slice(0, 5).map((r) => r.raw)}
          readOnly={readOnly}
          onSave={handleSaveMapping}
        />
      )}
      {step === "review" && <ReviewStep detail={detail} onContinue={() => setStep("import")} />}
      {step === "import" && <ImportStep detail={detail} onBack={() => setStep("review")} />}
    </div>
  );
}
