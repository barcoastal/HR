"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type PickerPlacement = {
  id: string;
  page: number;        // 1-indexed
  xPct: number;        // 0..1 center-x of placed box
  yPct: number;        // 0..1 center-y of placed box
  kind: "signature" | "signatureDate" | "countersignature" | "countersignatureDate";
};

const FIELDS: Array<{ key: PickerPlacement["kind"]; label: string; color: "purple" | "teal" | "amber" | "orange"; icon: string }> = [
  { key: "signature", label: "Recipient signature", color: "purple", icon: "draw" },
  { key: "signatureDate", label: "Recipient date", color: "teal", icon: "event" },
  { key: "countersignature", label: "Our signature", color: "amber", icon: "verified" },
  { key: "countersignatureDate", label: "Our date", color: "orange", icon: "event" },
];

const BOX_SIZE: Record<PickerPlacement["kind"], { w: number; h: number; label: string }> = {
  signature: { w: 26, h: 8, label: "✍ signature" },
  signatureDate: { w: 18, h: 4, label: "📅 date" },
  countersignature: { w: 26, h: 8, label: "✍ countersign" },
  countersignatureDate: { w: 18, h: 4, label: "📅 countersign date" },
};

const COLOR_CLASS: Record<string, string> = {
  purple: "border-purple-500 bg-purple-500/10 text-purple-700",
  teal: "border-teal-500 bg-teal-500/10 text-teal-700",
  amber: "border-amber-500 bg-amber-500/10 text-amber-700",
  orange: "border-orange-500 bg-orange-500/10 text-orange-700",
};

export function SignaturePlacementPicker({
  pdfUrl,
  showCountersign,
  value,
  onChange,
}: {
  pdfUrl: string;
  showCountersign: boolean;
  value: PickerPlacement[];
  onChange: (placements: PickerPlacement[]) => void;
}) {
  const [activeKind, setActiveKind] = useState<PickerPlacement["kind"]>("signature");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    const page = await pdfDocRef.current.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setCurrentPage(1);
      } catch (e) {
        console.error("[placement-picker] load error:", e);
        if (!cancelled) setError("Could not load PDF for placement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0) renderPage(currentPage);
  }, [currentPage, renderPage]);

  // When countersign is turned off, strip any countersign placements
  useEffect(() => {
    if (!showCountersign) {
      const filtered = value.filter((p) => p.kind === "signature" || p.kind === "signatureDate");
      if (filtered.length !== value.length) onChange(filtered);
      if (activeKind === "countersignature" || activeKind === "countersignatureDate") {
        setActiveKind("signature");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountersign]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const next: PickerPlacement = {
      id: crypto.randomUUID(),
      page: currentPage,
      xPct,
      yPct,
      kind: activeKind,
    };
    onChange([...value, next]);
  }

  function removePlacement(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }

  const visibleFields = FIELDS.filter((f) => showCountersign || (f.key !== "countersignature" && f.key !== "countersignatureDate"));
  const currentPagePlacements = value.filter((p) => p.page === currentPage);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
          Click the PDF to mark where fields go. Select a field type first:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {visibleFields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveKind(f.key)}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                activeKind === f.key
                  ? f.color === "purple" ? "bg-purple-600 text-white"
                  : f.color === "teal" ? "bg-teal-600 text-white"
                  : f.color === "amber" ? "bg-amber-600 text-white"
                  : "bg-orange-600 text-white"
                  : f.color === "purple" ? "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20"
                  : f.color === "teal" ? "bg-teal-500/10 text-teal-700 hover:bg-teal-500/20"
                  : f.color === "amber" ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                  : "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20"
              )}
            >
              <Icon name={f.icon} size={10} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded bg-[var(--color-surface-hover)] disabled:opacity-30"
          >Previous</button>
          <span className="text-[var(--color-text-muted)]">Page {currentPage} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage >= pageCount}
            className="px-2 py-1 rounded bg-[var(--color-surface-hover)] disabled:opacity-30"
          >Next</button>
        </div>
      )}

      {loading && (
        <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Loading PDF…</div>
      )}
      {error && (
        <div className="py-4 px-3 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>
      )}

      {!loading && !error && (
        <div className="relative rounded-lg border border-[var(--color-border)] bg-white overflow-hidden">
          <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full cursor-crosshair" />
          {currentPagePlacements.map((p) => {
            const meta = BOX_SIZE[p.kind];
            const colorKey = p.kind === "signature" ? "purple" : p.kind === "signatureDate" ? "teal" : p.kind === "countersignature" ? "amber" : "orange";
            return (
              <div
                key={p.id}
                className="absolute group"
                style={{
                  left: `${(p.xPct - meta.w / 200) * 100}%`,
                  top: `${(p.yPct - meta.h / 200) * 100}%`,
                  width: `${meta.w}%`,
                  height: `${meta.h}%`,
                }}
              >
                <div className={cn("w-full h-full rounded border-2 border-dashed flex items-center justify-center shadow-sm", COLOR_CLASS[colorKey])}>
                  <span className="text-[10px] font-mono font-bold whitespace-nowrap">{meta.label}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePlacement(p.id); }}
                  className="absolute -top-2 -right-2 hidden group-hover:flex h-4 w-4 rounded-full bg-red-500 text-white items-center justify-center text-[8px] font-bold shadow"
                >X</button>
              </div>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {value.length} placement{value.length !== 1 ? "s" : ""} marked.
        </p>
      )}
    </div>
  );
}
