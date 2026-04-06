"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type FormField = {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "radio";
  value: string;
  options?: string[];
};

type TextOverlay = {
  id: string;
  page: number;
  xPercent: number;
  yPercent: number;
  text: string;
};

type FillingData = {
  fields: FormField[];
  pageCount: number;
  documentName: string;
  employeeName: string;
  documentUrl: string;
};

function formatFieldLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\[(\d+)\]/g, " $1");
}

export function FillingPage({ token, data }: { token: string; data: FillingData }) {
  const hasFormFields = data.fields.length > 0;
  const [step, setStep] = useState<"review" | "fill" | "done">("review");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasFormFields) {
      const initial: Record<string, string> = {};
      for (const field of data.fields) {
        initial[field.name] = field.value || "";
      }
      setFieldValues(initial);
    }
  }, [data.fields, hasFormFields]);

  const updateField = (name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/fill/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues: hasFormFields ? fieldValues : {},
          textOverlays: !hasFormFields ? textOverlays.map(({ page, xPercent, yPercent, text }) => ({ page, xPercent, yPercent, text })) : [],
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStep("done");
      } else {
        setError(result.error || "Failed to submit form");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Completed</h1>
          <p className="text-gray-600 mb-4">
            You have successfully filled out <strong>{data.documentName}</strong>.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 border">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="person" size={16} className="text-gray-400" />
              <span className="text-gray-600">Completed by:</span>
              <span className="font-medium text-gray-900">{data.employeeName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="schedule" size={16} className="text-gray-400" />
              <span className="text-gray-600">Date:</span>
              <span className="font-medium text-gray-900">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="description" size={16} className="text-gray-400" />
              <span className="text-gray-600">Document:</span>
              <span className="font-medium text-gray-900 truncate">{data.documentName}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Fill Out Document</h1>
            <p className="text-sm text-gray-500">{data.documentName}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {["Review", "Fill"].map((label, i) => {
              const steps = ["review", "fill"];
              const current = steps.indexOf(step);
              const isActive = i <= current;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={cn("w-6 h-0.5", isActive ? "bg-teal-500" : "bg-gray-200")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    i === current ? "bg-teal-100 text-teal-700" : isActive ? "text-teal-600" : "text-gray-400"
                  )}>
                    {i < current ? (
                      <Icon name="check_circle" size={14} />
                    ) : (
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        i === current ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-500"
                      )}>{i + 1}</span>
                    )}
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {step === "review" && (
          <>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-6 flex items-start gap-3">
              <Icon name="waving_hand" size={20} className="text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-900">Hi {data.employeeName},</p>
                <p className="text-sm text-teal-700 mt-0.5">Please review the document below, then fill out the required fields.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                <Icon name="description" size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{data.documentName}</span>
              </div>
              <div className="p-4">
                <iframe
                  src={data.documentUrl}
                  className="w-full rounded border"
                  style={{ height: "60vh" }}
                  title="Document Preview"
                />
              </div>
            </div>

            <button
              onClick={() => setStep("fill")}
              className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-semibold text-base hover:bg-teal-700 transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99]"
            >
              <Icon name="edit_document" size={18} />
              Continue to Fill Out
            </button>
          </>
        )}

        {step === "fill" && (
          <div className="space-y-6">
            {hasFormFields ? (
              <FormFieldsMode
                fields={data.fields}
                fieldValues={fieldValues}
                onUpdateField={updateField}
                onBack={() => setStep("review")}
              />
            ) : (
              <TextOverlayMode
                documentUrl={data.documentUrl}
                overlays={textOverlays}
                onOverlaysChange={setTextOverlays}
                onBack={() => setStep("review")}
              />
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || (!hasFormFields && textOverlays.length === 0)}
              className={cn(
                "w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2.5 shadow-sm",
                !submitting && (hasFormFields || textOverlays.length > 0)
                  ? "bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.99]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              {submitting ? (
                <><Icon name="progress_activity" size={18} className="animate-material-spin" />Submitting...</>
              ) : (
                <><Icon name="check_circle" size={18} />Submit Completed Form</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mode 1: AcroForm fields as HTML inputs ──

function FormFieldsMode({
  fields, fieldValues, onUpdateField, onBack,
}: {
  fields: FormField[];
  fieldValues: Record<string, string>;
  onUpdateField: (name: string, value: string) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-100">
        <Icon name="info" size={16} className="text-teal-600 shrink-0" />
        <p className="text-sm text-teal-700">Fill in all the fields below.</p>
        <button onClick={onBack} className="ml-auto text-xs text-teal-600 hover:text-teal-800 font-medium underline">
          Back to review
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="edit_document" size={16} className="text-teal-600" />
            Form Fields ({fields.length})
          </h2>
        </div>
        <div className="p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                {formatFieldLabel(field.name)}
              </label>
              {field.type === "text" && (
                <input
                  type="text"
                  value={fieldValues[field.name] || ""}
                  onChange={(e) => onUpdateField(field.name, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                />
              )}
              {field.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldValues[field.name] === "true"}
                    onChange={(e) => onUpdateField(field.name, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
              )}
              {field.type === "dropdown" && (
                <select
                  value={fieldValues[field.name] || ""}
                  onChange={(e) => onUpdateField(field.name, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {field.type === "radio" && (
                <div className="flex flex-wrap gap-3">
                  {field.options?.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={field.name}
                        value={opt}
                        checked={fieldValues[field.name] === opt}
                        onChange={() => onUpdateField(field.name, opt)}
                        className="h-4 w-4 border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Mode 2: Click-to-type text overlay on PDF pages ──

function TextOverlayMode({
  documentUrl, overlays, onOverlaysChange, onBack,
}: {
  documentUrl: string;
  overlays: TextOverlay[];
  onOverlaysChange: (overlays: TextOverlay[]) => void;
  onBack: () => void;
}) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      try {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument(documentUrl).promise;
        if (cancelled) return;

        const images: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }

        if (!cancelled) {
          setPageImages(images);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [documentUrl]);

  function handlePageClick(e: React.MouseEvent<HTMLDivElement>) {
    // Don't add new overlay if clicking on an existing one
    if ((e.target as HTMLElement).closest("[data-overlay]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const id = crypto.randomUUID();
    const newOverlay: TextOverlay = {
      id,
      page: currentPage,
      xPercent,
      yPercent,
      text: "",
    };
    onOverlaysChange([...overlays, newOverlay]);
    setEditingId(id);
  }

  function updateOverlayText(id: string, text: string) {
    onOverlaysChange(overlays.map((o) => o.id === id ? { ...o, text } : o));
  }

  function removeOverlay(id: string) {
    onOverlaysChange(overlays.filter((o) => o.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const currentPageOverlays = overlays.filter((o) => o.page === currentPage);
  const filledCount = overlays.filter((o) => o.text.trim()).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-12 flex flex-col items-center justify-center">
        <Icon name="progress_activity" size={32} className="animate-material-spin text-teal-500 mb-3" />
        <p className="text-sm text-gray-500">Loading document pages...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-100">
        <Icon name="mouse" size={16} className="text-teal-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-teal-800">Click anywhere on the document to type text</p>
          <p className="text-xs text-teal-600 mt-0.5">
            {filledCount > 0 ? `${filledCount} field${filledCount !== 1 ? "s" : ""} filled` : "Click on a field to start typing"}
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-teal-600 hover:text-teal-800 font-medium underline">
          Back to review
        </button>
      </div>

      {/* Page navigation */}
      {pageImages.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <Icon name="chevron_left" size={16} />
          </button>
          <span className="text-sm text-gray-600 font-medium">
            Page {currentPage + 1} of {pageImages.length}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(pageImages.length - 1, currentPage + 1))}
            disabled={currentPage === pageImages.length - 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <Icon name="chevron_right" size={16} />
          </button>
        </div>
      )}

      {/* PDF page with overlays */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onClick={handlePageClick}
        >
          <img
            src={pageImages[currentPage]}
            alt={`Page ${currentPage + 1}`}
            className="w-full"
            draggable={false}
          />
          {/* Text overlay inputs */}
          {currentPageOverlays.map((overlay) => (
            <div
              key={overlay.id}
              data-overlay
              className="absolute group"
              style={{
                left: `${overlay.xPercent}%`,
                top: `${overlay.yPercent}%`,
                transform: "translate(-4px, -50%)",
              }}
            >
              <div className="flex items-center gap-0.5">
                <input
                  type="text"
                  value={overlay.text}
                  onChange={(e) => updateOverlayText(overlay.id, e.target.value)}
                  onFocus={() => setEditingId(overlay.id)}
                  autoFocus={editingId === overlay.id}
                  placeholder="Type here..."
                  className={cn(
                    "px-1.5 py-0.5 text-sm bg-yellow-50/90 border rounded shadow-sm outline-none min-w-[120px]",
                    editingId === overlay.id
                      ? "border-teal-500 ring-2 ring-teal-500/30"
                      : "border-yellow-300"
                  )}
                  style={{ fontSize: "13px" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeOverlay(overlay.id); }}
                  className="hidden group-hover:flex h-5 w-5 rounded-full bg-red-500 text-white items-center justify-center text-[10px] font-bold shadow shrink-0"
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary of all overlays */}
      {overlays.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Filled Fields ({filledCount} of {overlays.length})
          </p>
          <div className="space-y-1">
            {overlays.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-4">{i + 1}.</span>
                <span className="text-gray-500">p{o.page + 1}</span>
                <span className={cn("flex-1 truncate", o.text ? "text-gray-900" : "text-gray-300 italic")}>
                  {o.text || "empty"}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage(o.page);
                    setEditingId(o.id);
                  }}
                  className="text-teal-500 hover:text-teal-700"
                >
                  <Icon name="edit" size={12} />
                </button>
                <button onClick={() => removeOverlay(o.id)} className="text-red-400 hover:text-red-600">
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── PDF.js loader ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfJsPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPdfJs(): Promise<any> {
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__pdfjsLib) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve((window as any).__pdfjsLib);
      return;
    }

    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    moduleScript.textContent = `
      import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      window.__pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event("pdfjs-ready"));
    `;

    const handler = () => {
      window.removeEventListener("pdfjs-ready", handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve((window as any).__pdfjsLib);
    };
    window.addEventListener("pdfjs-ready", handler);

    document.head.appendChild(moduleScript);

    setTimeout(() => {
      window.removeEventListener("pdfjs-ready", handler);
      reject(new Error("PDF.js load timeout"));
    }, 10000);
  });

  return pdfJsPromise;
}
