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
  const [step, setStep] = useState<"fill" | "sign" | "place" | "preview" | "done">("fill");
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState<{ page: number; xPercent: number; yPercent: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isStaticPdf, setIsStaticPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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

        container.innerHTML = "";
        let totalFormFields = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const containerWidth = container.clientWidth || window.innerWidth - 32;
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          // Page wrapper
          const pageDiv = document.createElement("div");
          pageDiv.style.position = "relative";
          pageDiv.style.width = `${viewport.width}px`;
          pageDiv.style.height = `${viewport.height}px`;
          pageDiv.style.margin = "0 auto 8px";
          pageDiv.className = "shadow-sm border rounded overflow-hidden bg-white";
          pageDiv.dataset.pageIndex = String(i - 1);

          // Canvas
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
          const formAnnotations = annotations.filter((a: { fieldType?: string }) => a.fieldType);

          const annotLayer = document.createElement("div");
          annotLayer.style.position = "absolute";
          annotLayer.style.top = "0";
          annotLayer.style.left = "0";
          annotLayer.style.width = "100%";
          annotLayer.style.height = "100%";
          annotLayer.dataset.annotLayer = "true";

          if (formAnnotations.length > 0) {
            totalFormFields += formAnnotations.length;

            for (const annot of formAnnotations) {
              if (!annot.rect) continue;

              const [x1, y1, x2, y2] = annot.rect;
              const width = x2 - x1;
              const height = y2 - y1;

              const cssLeft = (x1 / baseViewport.width) * 100;
              const cssWidth = (width / baseViewport.width) * 100;
              const cssHeight = (height / baseViewport.height) * 100;
              const cssTop = 100 - ((y2) / baseViewport.height) * 100;

              if (annot.fieldType === "Tx") {
                const input = document.createElement("input");
                input.type = "text";
                input.dataset.fieldName = annot.fieldName;
                input.dataset.page = String(i - 1);
                input.value = annot.fieldValue || "";
                input.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  border:none;background:rgba(173,216,255,0.25);
                  font-size:${Math.max(7, Math.min(12, height * scale * 0.55))}px;
                  padding:1px 3px;box-sizing:border-box;
                  font-family:sans-serif;color:#000;outline:none;
                `;
                input.addEventListener("focus", () => { input.style.background = "rgba(173,216,255,0.5)"; input.style.borderBottom = "1px solid #3b82f6"; });
                input.addEventListener("blur", () => { input.style.background = "rgba(173,216,255,0.25)"; input.style.borderBottom = "none"; });
                annotLayer.appendChild(input);
              } else if (annot.fieldType === "Btn" && annot.checkBox) {
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.fieldName = annot.fieldName;
                cb.dataset.page = String(i - 1);
                cb.checked = !!annot.fieldValue && annot.fieldValue !== "Off";
                cb.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  margin:0;cursor:pointer;accent-color:#0d9488;
                `;
                annotLayer.appendChild(cb);
              } else if (annot.fieldType === "Ch") {
                const select = document.createElement("select");
                select.dataset.fieldName = annot.fieldName;
                select.dataset.page = String(i - 1);
                select.style.cssText = `
                  position:absolute;
                  left:${cssLeft}%;top:${cssTop}%;width:${cssWidth}%;height:${cssHeight}%;
                  border:none;background:rgba(173,216,255,0.25);
                  font-size:${Math.max(7, Math.min(11, height * scale * 0.55))}px;
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
          }

          pageDiv.appendChild(annotLayer);
          container.appendChild(pageDiv);
        }

        // If no form fields found, enable click-to-type mode
        if (totalFormFields === 0 && !cancelled) {
          setIsStaticPdf(true);
          // Add click handlers to all pages
          const allPageDivs = container.querySelectorAll<HTMLDivElement>(":scope > div");
          allPageDivs.forEach((pageDiv) => {
            pageDiv.style.cursor = "crosshair";
            pageDiv.addEventListener("click", (e) => {
              // Don't add if clicking on an existing input
              if ((e.target as HTMLElement).tagName === "INPUT") return;

              const rect = pageDiv.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              const leftPct = (clickX / rect.width) * 100;
              const topPct = (clickY / rect.height) * 100;

              const layer = pageDiv.querySelector("[data-annot-layer]") as HTMLDivElement;
              if (!layer) return;

              const input = document.createElement("input");
              input.type = "text";
              input.dataset.fieldName = `text_${Date.now()}`;
              input.dataset.page = pageDiv.dataset.pageIndex || "0";
              input.placeholder = "Type here...";
              input.style.cssText = `
                position:absolute;
                left:${leftPct}%;top:${topPct}%;
                min-width:100px;max-width:60%;height:18px;
                border:1px solid #0d9488;background:rgba(255,255,240,0.9);
                font-size:11px;padding:1px 4px;box-sizing:border-box;
                font-family:sans-serif;color:#000;outline:none;
                border-radius:2px;
              `;
              input.addEventListener("focus", () => { input.style.borderColor = "#0d9488"; input.style.boxShadow = "0 0 0 2px rgba(13,148,136,0.2)"; });
              input.addEventListener("blur", () => {
                input.style.boxShadow = "none";
                if (!input.value) { input.remove(); }
                else { input.style.borderColor = "transparent"; input.style.background = "transparent"; }
              });

              // Delete on backspace when empty
              input.addEventListener("keydown", (ke) => {
                if (ke.key === "Backspace" && !input.value) { input.remove(); }
                if (ke.key === "Enter") { input.blur(); }
              });

              layer.appendChild(input);
              input.focus();
            });
          });
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [data.documentUrl]);

  // Capture all pages as images (canvas + form values drawn on top)
  async function captureFilledPages(): Promise<string[]> {
    const container = pdfContainerRef.current;
    if (!container) return [];

    const pageDivs = container.querySelectorAll<HTMLDivElement>(":scope > div");
    const images: string[] = [];

    for (let i = 0; i < pageDivs.length; i++) {
      const pageDiv = pageDivs[i];
      const canvas = pageDiv.querySelector<HTMLCanvasElement>("canvas");
      if (!canvas) continue;

      // Create a copy of the canvas
      const outCanvas = document.createElement("canvas");
      outCanvas.width = canvas.width;
      outCanvas.height = canvas.height;
      const ctx = outCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);

      // Draw all form input values onto the canvas
      const inputs = pageDiv.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
      for (const el of inputs) {
        const rect = el.getBoundingClientRect();
        const pageRect = pageDiv.getBoundingClientRect();

        // Calculate position relative to canvas
        const scaleX = canvas.width / pageRect.width;
        const scaleY = canvas.height / pageRect.height;
        const x = (rect.left - pageRect.left) * scaleX;
        const y = (rect.top - pageRect.top) * scaleY;
        const w = rect.width * scaleX;
        const h = rect.height * scaleY;

        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          if (el.checked) {
            // Draw checkmark
            ctx.font = `bold ${h * 0.8}px sans-serif`;
            ctx.fillStyle = "#000";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", x + w * 0.15, y + h * 0.5);
          }
        } else {
          const value = el instanceof HTMLSelectElement ? el.options[el.selectedIndex]?.text || "" : el.value;
          if (value) {
            // Clear the field area first (white bg)
            ctx.fillStyle = "#fff";
            ctx.fillRect(x, y, w, h);
            // Draw the text
            const fontSize = Math.max(8, Math.min(14, h * 0.65));
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = "#000";
            ctx.textBaseline = "middle";
            ctx.fillText(value, x + 3, y + h / 2, w - 6);
          }
        }
      }

      images.push(outCanvas.toDataURL("image/png"));
    }

    return images;
  }

  async function handleGoToSign() {
    setError(null);
    // Capture pages NOW while the PDF container is still in the DOM
    const images = await captureFilledPages();
    if (images.length === 0) {
      setError("Could not capture form pages. Please try again.");
      return;
    }
    setPageImages(images);
    setError(null);
    setStep("sign");
  }

  async function handleGoToPlace() {
    if (!signatureBase64) return;
    setStep("place");
  }

  async function handleGoToPreview(placedPosition?: { page: number; xPercent: number; yPercent: number }) {
    const pos = placedPosition || sigPosition;
    if (!signatureBase64 || !pos) return;
    setSigPosition(pos);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/fill/${token}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageImages, signatureBase64, sigPosition: pos }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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
      const images = pageImages;

      const res = await fetch(`/api/fill/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageImages: images, signatureBase64, sigPosition }),
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

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Submitted</h1>
          <p className="text-gray-600 mb-4"><strong>{data.documentName}</strong> has been filled out and signed.</p>
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
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">{data.documentName}</h1>
            <p className="text-xs text-gray-500">{data.employeeName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {["Fill", "Sign", "Place", "Preview"].map((label, i) => {
              const steps = ["fill", "sign", "place", "preview"];
              const current = steps.indexOf(step);
              return (
                <div key={label} className="flex items-center gap-1">
                  {i > 0 && <div className={cn("w-3 h-0.5", i <= current ? "bg-teal-400" : "bg-gray-200")} />}
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    i === current ? "bg-teal-100 text-teal-700" : i < current ? "text-teal-500" : "text-gray-400"
                  )}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto">
        {/* Fill */}
        {step === "fill" && (
          <>
            <div className="bg-teal-50 border-b border-teal-100 px-4 py-3 flex items-center gap-3">
              <Icon name="edit_document" size={16} className="text-teal-600 shrink-0" />
              <p className="text-sm text-teal-700">
                {isStaticPdf
                  ? "Tap anywhere on the document to add text."
                  : "Tap any field and type to fill it in."}
              </p>
            </div>
            <div ref={pdfContainerRef} className="p-3 space-y-2" />
            <div className="sticky bottom-0 bg-white border-t p-3 shadow-lg">
              <button onClick={handleGoToSign}
                className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2 shadow-sm">
                <Icon name="draw" size={16} />Continue to Sign
              </button>
            </div>
          </>
        )}

        {/* Sign */}
        {step === "sign" && (
          <div className="p-4 space-y-4">
            <SignaturePad name={data.employeeName} onSignature={setSignatureBase64} />
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep("fill")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200">Back</button>
              <button onClick={handleGoToPlace} disabled={!signatureBase64}
                className={cn("flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm",
                  signatureBase64 ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}>
                <Icon name="place" size={16} />Place Signature
              </button>
            </div>
          </div>
        )}

        {/* Place signature */}
        {step === "place" && (
          <SignaturePlacement
            pageImages={pageImages}
            signatureBase64={signatureBase64!}
            employeeName={data.employeeName}
            onPlaced={(pos) => handleGoToPreview(pos)}
            onBack={() => setStep("sign")}
            submitting={submitting}
            error={error}
          />
        )}

        {/* Preview */}
        {step === "preview" && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="fact_check" size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">Review the completed document. Go back to make changes.</p>
            </div>
            {previewUrl && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <iframe src={previewUrl} className="w-full" style={{ height: "65vh" }} title="Preview" />
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setStep("fill"); setPageImages([]); }}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200">Edit</button>
              <button onClick={handleSubmit} disabled={submitting}
                className={cn("flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm",
                  !submitting ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}>
                {submitting
                  ? <><Icon name="progress_activity" size={16} className="animate-material-spin" />Submitting...</>
                  : <><Icon name="check_circle" size={16} />Confirm & Submit</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Signature Placement ──

function SignaturePlacement({ pageImages, signatureBase64, employeeName, onPlaced, onBack, submitting, error }: {
  pageImages: string[];
  signatureBase64: string;
  employeeName: string;
  onPlaced: (pos: { page: number; xPercent: number; yPercent: number }) => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    onPlaced({ page: currentPage, xPercent, yPercent });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3">
        <Icon name="place" size={18} className="text-teal-600 shrink-0 mt-0.5" />
        <p className="text-sm text-teal-700">Tap where you want your signature placed on the document.</p>
      </div>

      {pageImages.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
            <Icon name="chevron_left" size={16} />
          </button>
          <span className="text-sm text-gray-600 font-medium">Page {currentPage + 1} of {pageImages.length}</span>
          <button onClick={() => setCurrentPage(Math.min(pageImages.length - 1, currentPage + 1))} disabled={currentPage === pageImages.length - 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
            <Icon name="chevron_right" size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div
          className="relative cursor-crosshair"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPos(null)}
        >
          <img src={pageImages[currentPage]} alt={`Page ${currentPage + 1}`} className="w-full" draggable={false} />
          {hoverPos && (
            <div className="absolute pointer-events-none" style={{ left: hoverPos.x - 5, top: hoverPos.y - 5 }}>
              <div className="border-2 border-teal-500 border-dashed rounded bg-teal-500/5 p-1" style={{ width: 150, minHeight: 55 }}>
                <img src={signatureBase64} alt="sig" className="h-6 opacity-60" />
                <div className="border-t border-teal-300/50 mt-0.5 pt-0.5">
                  <p className="text-[9px] text-teal-600 font-medium leading-tight">{employeeName}</p>
                  <p className="text-[8px] text-teal-400">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
          <Icon name="error" size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {submitting && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
          <Icon name="progress_activity" size={16} className="animate-material-spin" />Generating preview...
        </div>
      )}

      <button onClick={onBack} className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200">
        Back to Signature
      </button>
    </div>
  );
}

// ── Signature Pad ──

function SignaturePad({ name, onSignature }: { name: string; onSignature: (b64: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * sx, y: (cy - r.top) * sy };
  };

  const start = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true; setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#1a1a2e";
    const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }, []);
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  }, []);
  const end = useCallback(() => {
    isDrawing.current = false;
    if (canvasRef.current) onSignature(canvasRef.current.toDataURL("image/png"));
  }, [onSignature]);
  const clear = () => {
    const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false); onSignature(null);
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
          <canvas ref={canvasRef} width={600} height={150}
            className="w-full cursor-crosshair touch-none" style={{ height: "120px" }}
            onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
          {!hasDrawn && <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-300 italic">Sign here</p>
          </div>}
        </div>
        {hasDrawn && <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
          <Icon name="undo" size={12} />Clear
        </button>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-gray-400 mb-1">Name</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{name}</div></div>
          <div><label className="block text-xs text-gray-400 mb-1">Date</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{date}</div></div>
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
    const s = document.createElement("script"); s.type = "module";
    s.textContent = `
      import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      window.__pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event("pdfjs-ready"));
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = () => { window.removeEventListener("pdfjs-ready", h); resolve((window as any).__pdfjsLib); };
    window.addEventListener("pdfjs-ready", h);
    document.head.appendChild(s);
    setTimeout(() => { window.removeEventListener("pdfjs-ready", h); reject(new Error("PDF.js timeout")); }, 10000);
  });
  return pdfJsPromise;
}
