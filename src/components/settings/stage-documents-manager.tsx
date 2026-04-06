"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createStageDocument,
  updateStageDocument,
  deleteStageDocument,
} from "@/lib/actions/stage-documents";
import { AVAILABLE_PLACEHOLDERS } from "@/lib/stage-document-utils";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type PlaceholderPosition = {
  id: string;
  page: number;
  x: number; // percentage of page width
  y: number; // percentage of page height
  placeholder: string; // e.g. "{{firstName}}"
  fontSize: number;
};

type StageDoc = {
  id: string;
  stage: string;
  name: string;
  placeholders: string; // JSON
  requiresSignature: boolean;
  requiresFill: boolean;
  order: number;
  hasPdf: boolean;
};

const STAGES = [
  { value: "PRE_ONBOARDING", label: "Pre-Onboarding" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "OFFBOARDING", label: "Offboarding" },
];

export function StageDocumentsManager({ documents }: { documents: StageDoc[] }) {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState("PRE_ONBOARDING");
  const [editing, setEditing] = useState<StageDoc | null>(null);
  const [creating, setCreating] = useState(false);

  const stageDocs = documents.filter((d) => d.stage === activeStage);

  function cancel() {
    setCreating(false);
    setEditing(null);
  }

  return (
    <section className="rounded-xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="description" size={20} className="text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Stage Documents</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Upload PDFs and mark where to fill in candidate data. Sent automatically on stage change.
            </p>
          </div>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 mb-5">
        {STAGES.map((s) => {
          const count = documents.filter((d) => d.stage === s.value).length;
          return (
            <button
              key={s.value}
              onClick={() => { setActiveStage(s.value); cancel(); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeStage === s.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s.label} {count > 0 && <span className="ml-1 text-xs opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Document list */}
      {!creating && !editing && (
        <>
          <div className="space-y-2 mb-4">
            {stageDocs.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] italic py-4 text-center">
                No documents configured for this stage yet.
              </p>
            )}
            {stageDocs.map((doc) => {
              const placeholders: PlaceholderPosition[] = JSON.parse(doc.placeholders || "[]");
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon name="picture_as_pdf" size={18} className="text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                      <p className={cn("text-xs flex items-center gap-1.5", !doc.hasPdf ? "text-amber-400" : "text-[var(--color-text-muted)]")}>
                        {!doc.hasPdf ? "No PDF — click edit to upload" : `${placeholders.length} placeholder${placeholders.length !== 1 ? "s" : ""} marked`}
                        {doc.requiresSignature && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400">
                            <Icon name="draw" size={10} />sign
                          </span>
                        )}
                        {doc.requiresFill && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-400">
                            <Icon name="edit_document" size={10} />fill
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(doc)}
                      className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this document?")) return;
                        await deleteStageDocument(doc.id);
                        router.refresh();
                      }}
                      className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            + Upload PDF Document
          </button>
        </>
      )}

      {/* Create/Edit form */}
      {(creating || editing) && (
        <PdfDocumentEditor
          stage={activeStage}
          existing={editing}
          onDone={() => { cancel(); router.refresh(); }}
          onCancel={cancel}
        />
      )}
    </section>
  );
}

// ─── PDF Document Editor ───

function PdfDocumentEditor({
  stage,
  existing,
  onDone,
  onCancel,
}: {
  stage: string;
  existing: StageDoc | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(
    existing?.hasPdf ? `/api/stage-documents/${existing.id}` : null
  );
  const needsUpload = existing && !existing.hasPdf && !pdfBase64;
  const [placeholders, setPlaceholders] = useState<PlaceholderPosition[]>(
    existing ? JSON.parse(existing.placeholders || "[]") : []
  );
  const [requiresSignature, setRequiresSignature] = useState(existing?.requiresSignature ?? false);
  const [requiresFill, setRequiresFill] = useState(existing?.requiresFill ?? false);
  const [saving, setSaving] = useState(false);
  const [activePlaceholder, setActivePlaceholder] = useState<string>("{{fullName}}");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDF.js
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    setPageRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (err) {
      console.error("Failed to render PDF page:", err);
    }
    setPageRendering(false);
  }, []);

  const loadPdf = useCallback(async (data: ArrayBuffer | string) => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      let source: { data: ArrayBuffer } | { url: string };
      if (typeof data === "string") {
        // For URL sources, fetch as ArrayBuffer first to avoid CORS/streaming issues
        const resp = await fetch(data);
        if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        source = { data: arrayBuf };
      } else {
        source = { data };
      }
      const pdf = await pdfjsLib.getDocument(source).promise;
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);
      // Reset to page 0 first so setting to 1 always triggers the effect
      setCurrentPage(0);
    } catch (err) {
      console.error("Failed to load PDF:", err);
      setPdfError("Failed to load PDF. Try re-uploading the file.");
      setPageCount(0);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  // Load existing PDF
  useEffect(() => {
    if (existing && pdfUrl) {
      loadPdf(pdfUrl);
    }
  }, [existing, pdfUrl, loadPdf]);

  // When pageCount is set and currentPage is 0, set to page 1 (after canvas mounts)
  useEffect(() => {
    if (pageCount > 0 && currentPage === 0) {
      setCurrentPage(1);
    }
  }, [pageCount, currentPage]);

  // Re-render on page change
  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [currentPage, renderPage]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    if (!name) setName(file.name.replace(/\.pdf$/i, ""));

    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      setPdfBase64(base64);
      setPdfUrl(null);
      setPlaceholders([]);
      await loadPdf(arrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !activePlaceholder) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPlaceholder: PlaceholderPosition = {
      id: crypto.randomUUID(),
      page: currentPage,
      x,
      y,
      placeholder: activePlaceholder,
      fontSize: 12,
    };
    setPlaceholders((prev) => [...prev, newPlaceholder]);
  }

  function removePlaceholder(id: string) {
    setPlaceholders((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (!pdfBase64 && !existing) return;
    setSaving(true);
    try {
      const placeholdersJson = JSON.stringify(placeholders);
      if (existing) {
        const updateData: { name: string; placeholders: string; requiresSignature: boolean; requiresFill: boolean; pdfData?: string } = {
          name: name.trim(),
          placeholders: placeholdersJson,
          requiresSignature,
          requiresFill,
        };
        if (pdfBase64) updateData.pdfData = pdfBase64;
        await updateStageDocument(existing.id, updateData);
      } else {
        await createStageDocument({
          stage,
          name: name.trim(),
          pdfData: pdfBase64!,
          placeholders: placeholdersJson,
          requiresSignature,
          requiresFill,
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const currentPagePlaceholders = placeholders.filter((p) => p.page === currentPage);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Document Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Employment Contract, NDA"
          className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />
      </div>

      {/* Document action selector */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">Document Action</label>
        <div className="flex gap-2">
          {[
            { value: "attachment", label: "Attachment", desc: "Sent as email attachment", icon: "attach_email" as const, color: "bg-gray-100 text-gray-600 border-gray-200" },
            { value: "sign", label: "Sign", desc: "Send signing link", icon: "draw" as const, color: "bg-purple-500/10 text-purple-600 border-purple-300" },
            { value: "fill", label: "Fill", desc: "Send fillable form link", icon: "edit_document" as const, color: "bg-teal-500/10 text-teal-600 border-teal-300" },
          ].map((opt) => {
            const isActive = opt.value === "sign" ? requiresSignature : opt.value === "fill" ? requiresFill : !requiresSignature && !requiresFill;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setRequiresSignature(opt.value === "sign");
                  setRequiresFill(opt.value === "fill");
                }}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border-2 text-center transition-all",
                  isActive ? opt.color : "border-transparent bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-border)]"
                )}
              >
                <Icon name={opt.icon} size={18} />
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PDF Upload — show for new docs or existing docs without PDF */}
      {!pdfBase64 && (!existing || needsUpload) && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--color-accent)]/50 transition-colors"
        >
          <Icon name="upload_file" size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-primary)] font-medium">
            {needsUpload ? "Upload a PDF to add placeholders" : "Click to upload PDF"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {needsUpload ? "This document needs a PDF file to mark placeholder positions" : "Upload a contract, NDA, or any document template"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Loading state */}
      {pdfLoading && (
        <div className="flex items-center justify-center py-12 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)]">
          <div className="text-center">
            <Icon name="hourglass_empty" size={32} className="text-[var(--color-accent)] mx-auto mb-2 animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Loading PDF...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {pdfError && (
        <div className="flex flex-col items-center py-8 border border-red-500/30 rounded-lg bg-red-500/5">
          <Icon name="error" size={32} className="text-red-400 mb-2" />
          <p className="text-sm text-red-400 mb-3">{pdfError}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            Re-upload PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* PDF Preview + Placeholder Placement */}
      {(pdfBase64 || existing) && pageCount > 0 && !pdfLoading && (
        <>
          {/* Placeholder selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Click on the PDF to place a field. Select which field:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActivePlaceholder(p.key)}
                  title={p.description}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-mono transition-colors",
                    activePlaceholder === p.key
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                  )}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Page {currentPage} of {pageCount}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}

          {/* Canvas with overlaid placeholders */}
          <div ref={containerRef} className="relative border border-[var(--color-border)] rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={cn("w-full cursor-crosshair", pageRendering && "opacity-50")}
            />
            {/* Placeholder markers */}
            {currentPagePlaceholders.map((p) => (
              <div
                key={p.id}
                className="absolute flex items-center gap-0.5 group"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--color-accent)] text-white shadow-md whitespace-nowrap">
                  {p.placeholder}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removePlaceholder(p.id); }}
                  className="hidden group-hover:flex h-4 w-4 rounded-full bg-red-500 text-white items-center justify-center text-[8px] font-bold shadow"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          {/* Replace PDF */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Replace PDF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Placed placeholders summary */}
          {placeholders.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1">
                Placed Fields ({placeholders.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {placeholders.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  >
                    {p.placeholder} (p{p.page})
                    <button
                      onClick={() => removePlaceholder(p.id)}
                      className="text-red-400 hover:text-red-500 font-bold"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || (!pdfBase64 && !existing)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : existing ? "Update Document" : "Save Document"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
