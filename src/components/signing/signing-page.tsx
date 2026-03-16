"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FileText, Check, Loader2, PenLine, ChevronLeft, ChevronRight, MousePointer2, X } from "lucide-react";

type SigningData = {
  documentUrl: string;
  documentName: string;
  employeeName: string;
  status: string;
};

type SignaturePosition = {
  xPercent: number;
  yPercent: number;
  page: number;
};

export function SigningPage({ token, data, testMode }: { token: string; data: SigningData; testMode?: boolean }) {
  const [mode, setMode] = useState<"view" | "place" | "sign" | "done">("view");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState<SignaturePosition | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !agreed) return;
    setSubmitting(true);
    setError(null);

    if (testMode) {
      setTimeout(() => {
        setSubmitting(false);
        setMode("done");
      }, 1000);
      return;
    }

    try {
      const signatureBase64 = canvas.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureBase64,
          signaturePosition: sigPosition || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setMode("done");
      } else {
        setError(result.error || "Failed to submit signature");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {testMode && (
          <div className="fixed top-0 left-0 right-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-center z-50">
            <span className="text-sm font-medium text-amber-800">Test Mode — No documents were actually signed.</span>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{testMode ? "Test Complete" : "Document Signed"}</h1>
          <p className="text-gray-600">
            {testMode
              ? <>This is what employees see after signing <strong>{data.documentName}</strong>.</>
              : <>Thanks for signing <strong>{data.documentName}</strong>. A copy has been saved to your file.</>
            }
          </p>
          {testMode && (
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Close Preview
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {testMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-center">
          <span className="text-sm font-medium text-amber-800">Test Mode — This is a preview of what employees will see. No documents will be signed.</span>
        </div>
      )}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Document Signing</h1>
        <p className="text-sm text-gray-500">Hi {data.employeeName}, please review and sign the document below.</p>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* PDF Viewer / Placement Mode */}
        {mode === "place" ? (
          <PlacementView
            documentUrl={data.documentUrl}
            onPlaced={(pos) => {
              setSigPosition(pos);
              setMode("sign");
            }}
            onCancel={() => setMode("view")}
          />
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                <FileText className="h-4 w-4 text-gray-500" />
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

            {/* Actions */}
            {mode === "view" && (
              <div className="space-y-3">
                <button
                  onClick={() => setMode("place")}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <PenLine className="h-4 w-4" />
                  Proceed to Sign
                </button>
              </div>
            )}

            {mode === "sign" && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                {sigPosition && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-sm text-blue-700">Signature placement selected on page {sigPosition.page + 1}</p>
                    <button
                      onClick={() => setMode("place")}
                      className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Change
                    </button>
                  </div>
                )}

                <h2 className="text-sm font-semibold text-gray-900 mb-3">Draw your signature</h2>
                <div className="border rounded-lg overflow-hidden mb-3 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <button onClick={clearCanvas} className="text-xs text-gray-500 hover:text-gray-700 mb-4">
                  Clear signature
                </button>

                <label className="flex items-start gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    I agree that this electronic signature is the legal equivalent of my handwritten signature.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!agreed || submitting}
                  className={cn(
                    "w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2",
                    agreed && !submitting
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  )}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? "Signing..." : "Sign & Submit"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Placement view — renders PDF pages as images, user clicks to place signature
function PlacementView({
  documentUrl,
  onPlaced,
  onCancel,
}: {
  documentUrl: string;
  onPlaced: (pos: SignaturePosition) => void;
  onCancel: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF pages as images using canvas
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      try {
        // Use pdf.js via CDN
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument(documentUrl).promise;
        if (cancelled) return;

        setTotalPages(pdf.numPages);
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
          setCurrentPage(pdf.numPages - 1); // Default to last page
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

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    onPlaced({ xPercent, yPercent, page: currentPage });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-12 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Loading document pages...</p>
      </div>
    );
  }

  if (pageImages.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
        <p className="text-sm text-gray-500 mb-3">Could not render document for placement. Using default position.</p>
        <button
          onClick={() => onPlaced({ xPercent: 10, yPercent: 65, page: 0 })}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue with default position
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
        <MousePointer2 className="h-5 w-5 text-blue-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">Click where you want to place your signature</p>
          <p className="text-xs text-blue-600 mt-0.5">Navigate pages below, then click the exact spot on the document.</p>
        </div>
        <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg hover:bg-blue-100 text-blue-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 font-medium">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page image with click area */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div
          ref={containerRef}
          className="relative cursor-crosshair"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPos(null)}
        >
          <img
            src={pageImages[currentPage]}
            alt={`Page ${currentPage + 1}`}
            className="w-full"
            draggable={false}
          />
          {/* Hover indicator */}
          {hoverPos && (
            <div
              className="absolute pointer-events-none border-2 border-blue-500 border-dashed rounded bg-blue-500/5"
              style={{
                left: hoverPos.x - 5,
                top: hoverPos.y - 5,
                width: 180,
                height: 50,
              }}
            >
              <span className="absolute -top-5 left-0 text-xs text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                Signature here
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Lazy-load pdf.js from CDN
let pdfJsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
    script.type = "module";

    // Use a different approach - load via dynamic import
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
      resolve((window as any).__pdfjsLib);
    };
    window.addEventListener("pdfjs-ready", handler);

    document.head.appendChild(moduleScript);

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener("pdfjs-ready", handler);
      reject(new Error("PDF.js load timeout"));
    }, 10000);
  });

  return pdfJsPromise;
}
