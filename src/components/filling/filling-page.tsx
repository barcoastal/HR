"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type FillingData = {
  fields: { name: string; type: string; value: string; options?: string[] }[];
  detectedFields: unknown[];
  pageCount: number;
  documentName: string;
  employeeName: string;
  documentUrl: string;
};

export function FillingPage({ token, data }: { token: string; data: FillingData }) {
  const [step, setStep] = useState<"fill" | "sign" | "preview" | "done">("fill");
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledPdfBytes, setFilledPdfBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotationStorageRef = useRef<any>(null);

  // Load and render PDF with form support
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      const container = pdfContainerRef.current;
      if (!container) return;

      try {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument(data.documentUrl).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        container.innerHTML = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = Math.min(
            (container.clientWidth || window.innerWidth - 32) / page.getViewport({ scale: 1 }).width,
            2
          );
          const viewport = page.getViewport({ scale });

          // Page wrapper
          const pageDiv = document.createElement("div");
          pageDiv.style.position = "relative";
          pageDiv.style.width = `${viewport.width}px`;
          pageDiv.style.height = `${viewport.height}px`;
          pageDiv.style.margin = "0 auto 8px";
          pageDiv.className = "shadow-sm border rounded-lg overflow-hidden bg-white";

          // Canvas layer
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          pageDiv.appendChild(canvas);

          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Annotation layer (form fields)
          const annotations = await page.getAnnotations();
          if (annotations.length > 0) {
            const annotLayer = document.createElement("div");
            annotLayer.style.position = "absolute";
            annotLayer.style.top = "0";
            annotLayer.style.left = "0";
            annotLayer.style.width = "100%";
            annotLayer.style.height = "100%";

            for (const annot of annotations) {
              if (!annot.rect) continue;

              const [x1, y1, x2, y2] = annot.rect;
              const left = (x1 / viewport.width) * scale * 100 / scale;
              const bottom = y1;
              const width = x2 - x1;
              const height = y2 - y1;

              // Convert PDF coords to CSS (PDF origin is bottom-left)
              const cssLeft = (x1 / (viewport.width / scale)) * 100;
              const cssBottom = (y1 / (viewport.height / scale)) * 100;
              const cssWidth = (width / (viewport.width / scale)) * 100;
              const cssHeight = (height / (viewport.height / scale)) * 100;
              const cssTop = 100 - cssBottom - cssHeight;

              if (annot.fieldType === "Tx") {
                // Text field
                const input = document.createElement("input");
                input.type = "text";
                input.dataset.fieldName = annot.fieldName;
                input.dataset.annotId = annot.id;
                input.value = annot.fieldValue || "";
                input.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  border:none;background:rgba(200,220,255,0.3);
                  font-size:${Math.max(8, Math.min(12, height * scale * 0.6))}px;
                  padding:1px 2px;box-sizing:border-box;
                  font-family:sans-serif;color:#111;outline:none;
                `;
                input.addEventListener("focus", () => { input.style.background = "rgba(200,220,255,0.5)"; });
                input.addEventListener("blur", () => { input.style.background = "rgba(200,220,255,0.3)"; });
                annotLayer.appendChild(input);
              } else if (annot.fieldType === "Btn" && annot.checkBox) {
                // Checkbox
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.fieldName = annot.fieldName;
                cb.dataset.annotId = annot.id;
                cb.checked = !!annot.fieldValue && annot.fieldValue !== "Off";
                cb.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  margin:0;cursor:pointer;accent-color:#0d9488;
                `;
                annotLayer.appendChild(cb);
              } else if (annot.fieldType === "Ch") {
                // Dropdown/select
                const select = document.createElement("select");
                select.dataset.fieldName = annot.fieldName;
                select.dataset.annotId = annot.id;
                select.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  border:none;background:rgba(200,220,255,0.3);
                  font-size:${Math.max(8, Math.min(11, height * scale * 0.6))}px;
                  padding:0 2px;box-sizing:border-box;
                `;
                if (annot.options) {
                  for (const opt of annot.options) {
                    const option = document.createElement("option");
                    option.value = opt.exportValue || opt.displayValue;
                    option.textContent = opt.displayValue;
                    select.appendChild(option);
                  }
                }
                if (annot.fieldValue) select.value = annot.fieldValue;
                annotLayer.appendChild(select);
              }
            }

            pageDiv.appendChild(annotLayer);
          }

          container.appendChild(pageDiv);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [data.documentUrl]);

  // Collect form values from the rendered DOM
  function collectFormValues(): Record<string, string> {
    const container = pdfContainerRef.current;
    if (!container) return {};

    const values: Record<string, string> = {};
    const inputs = container.querySelectorAll("input[data-field-name], select[data-field-name]");
    inputs.forEach((el) => {
      const name = (el as HTMLElement).dataset.fieldName || "";
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") {
          values[name] = el.checked ? "true" : "false";
        } else {
          values[name] = el.value;
        }
      } else if (el instanceof HTMLSelectElement) {
        values[name] = el.value;
      }
    });
    return values;
  }

  async function handleGoToSign() {
    // Save form state before leaving
    setStep("sign");
  }

  async function handleGoToPreview() {
    if (!signatureBase64) return;
    setSubmitting(true);
    setError(null);

    try {
      // Collect form data and generate preview
      const formValues = collectFormValues();
      const res = await fetch(`/api/fill/${token}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValues: formValues, signatureBase64 }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStep("preview");
    } catch {
      setError("Failed to generate preview. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const formValues = collectFormValues();
      const res = await fetch(`/api/fill/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValues: formValues, signatureBase64 }),
      });
      const result = await res.json();
      if (result.success) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setStep("done");
      } else {
        setError(result.error || "Failed to submit");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const formattedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Done ──
  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Submitted</h1>
          <p className="text-gray-600 mb-4">
            <strong>{data.documentName}</strong> has been filled out and signed.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 border">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="person" size={16} className="text-gray-400" />
              <span className="text-gray-600">By:</span>
              <span className="font-medium text-gray-900">{data.employeeName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="schedule" size={16} className="text-gray-400" />
              <span className="text-gray-600">Date:</span>
              <span className="font-medium text-gray-900">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">{data.documentName}</h1>
            <p className="text-xs text-gray-500">{data.employeeName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {["Fill", "Sign", "Preview"].map((label, i) => {
              const steps = ["fill", "sign", "preview"];
              const current = steps.indexOf(step);
              return (
                <div key={label} className="flex items-center gap-1">
                  {i > 0 && <div className={cn("w-3 h-0.5", i <= current ? "bg-teal-400" : "bg-gray-200")} />}
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    i === current ? "bg-teal-100 text-teal-700" : i < current ? "text-teal-500" : "text-gray-400"
                  )}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
        {/* ── Fill step ── */}
        {step === "fill" && (
          <>
            <div className="bg-teal-50 border-b border-teal-100 px-4 py-3 flex items-center gap-3">
              <Icon name="edit_document" size={16} className="text-teal-600 shrink-0" />
              <p className="text-sm text-teal-700">Tap on any field and type to fill it in.</p>
            </div>

            <div ref={pdfContainerRef} className="p-4 space-y-2" />

            <div className="sticky bottom-0 bg-white border-t p-4 shadow-lg">
              <button
                onClick={handleGoToSign}
                className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Icon name="draw" size={16} />
                Continue to Sign
              </button>
            </div>
          </>
        )}

        {/* ── Sign step ── */}
        {step === "sign" && (
          <div className="p-4 space-y-4">
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="draw" size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <p className="text-sm text-teal-700">Draw your signature below.</p>
            </div>

            <SignaturePad name={data.employeeName} onSignature={setSignatureBase64} />

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("fill")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleGoToPreview}
                disabled={!signatureBase64 || submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm",
                  signatureBase64 && !submitting
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <><Icon name="progress_activity" size={16} className="animate-material-spin" />Generating preview...</>
                ) : (
                  <><Icon name="preview" size={16} />Preview Document</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Preview step ── */}
        {step === "preview" && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="fact_check" size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">Review the completed document. Go back to make changes.</p>
            </div>

            {previewUrl && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <iframe
                  src={previewUrl}
                  className="w-full rounded"
                  style={{ height: "65vh" }}
                  title="Filled Document Preview"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("fill")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200"
              >
                Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm",
                  !submitting
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <><Icon name="progress_activity" size={16} className="animate-material-spin" />Submitting...</>
                ) : (
                  <><Icon name="check_circle" size={16} />Confirm & Submit</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Signature Pad ──

function SignaturePad({ name, onSignature }: { name: string; onSignature: (b64: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  };

  const start = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a2e";
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }, []);

  const end = useCallback(() => {
    isDrawing.current = false;
    if (canvasRef.current) onSignature(canvasRef.current.toDataURL("image/png"));
  }, [onSignature]);

  const clear = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
    onSignature(null);
  };

  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="draw" size={16} className="text-teal-600" />Your Signature
        </h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef} width={600} height={150}
            className="w-full cursor-crosshair touch-none" style={{ height: "120px" }}
            onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-300 italic">Sign here</p>
            </div>
          )}
        </div>
        {hasDrawn && (
          <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
            <Icon name="undo" size={12} />Clear
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{name}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{date}</div>
          </div>
        </div>
      </div>
    </div>
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
    if ((window as any).__pdfjsLib) { resolve((window as any).__pdfjsLib); return; }
    const s = document.createElement("script");
    s.type = "module";
    s.textContent = `
      import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      window.__pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event("pdfjs-ready"));
    `;
    const h = () => { window.removeEventListener("pdfjs-ready", h); resolve((window as any).__pdfjsLib); };
    window.addEventListener("pdfjs-ready", h);
    document.head.appendChild(s);
    setTimeout(() => { window.removeEventListener("pdfjs-ready", h); reject(new Error("PDF.js timeout")); }, 10000);
  });
  return pdfJsPromise;
}
