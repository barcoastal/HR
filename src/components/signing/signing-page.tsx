"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

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
  const [step, setStep] = useState<"review" | "place" | "sign" | "confirm" | "done">("review");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState<SignaturePosition | null>(null);
  const [typedName, setTypedName] = useState(data.employeeName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signedAt] = useState(() => new Date());

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    setHasDrawn(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a2e";
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !agreed || !hasDrawn || !typedName.trim()) return;
    setSubmitting(true);
    setError(null);

    if (testMode) {
      setTimeout(() => {
        setSubmitting(false);
        setStep("done");
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
          typedName: typedName.trim(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setStep("done");
      } else {
        setError(result.error || "Failed to submit signature");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const formattedTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // Done screen
  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {testMode && (
          <div className="fixed top-0 left-0 right-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-center z-50">
            <span className="text-sm font-medium text-amber-800">Test Mode — No documents were actually signed.</span>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{testMode ? "Test Complete" : "Document Signed"}</h1>
          <p className="text-gray-600 mb-4">
            {testMode
              ? <>This is what signers see after signing <strong>{data.documentName}</strong>.</>
              : <>You have successfully signed <strong>{data.documentName}</strong>.</>
            }
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 border">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="person" size={16} className="text-gray-400" />
              <span className="text-gray-600">Signed by:</span>
              <span className="font-medium text-gray-900">{typedName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="schedule" size={16} className="text-gray-400" />
              <span className="text-gray-600">Date:</span>
              <span className="font-medium text-gray-900">{formattedDate} at {formattedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="description" size={16} className="text-gray-400" />
              <span className="text-gray-600">Document:</span>
              <span className="font-medium text-gray-900 truncate">{data.documentName}</span>
            </div>
          </div>
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
          <span className="text-sm font-medium text-amber-800">Test Mode — This is a preview. No documents will be signed.</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Document Signing</h1>
            <p className="text-sm text-gray-500">{data.documentName}</p>
          </div>
          {/* Progress indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {["Review", "Place", "Sign"].map((label, i) => {
              const steps = ["review", "place", "sign"];
              const current = steps.indexOf(step);
              const isActive = i <= current;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={cn("w-6 h-0.5", isActive ? "bg-blue-500" : "bg-gray-200")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    i === current ? "bg-blue-100 text-blue-700" : isActive ? "text-blue-600" : "text-gray-400"
                  )}>
                    {i < current ? (
                      <Icon name="check_circle" size={14} />
                    ) : (
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        i === current ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
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
        {/* Welcome banner */}
        {step === "review" && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Icon name="waving_hand" size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Hi {data.employeeName},</p>
              <p className="text-sm text-blue-700 mt-0.5">Please review the document below, then proceed to sign it.</p>
            </div>
          </div>
        )}

        {/* Placement mode */}
        {step === "place" ? (
          <PlacementView
            documentUrl={data.documentUrl}
            onPlaced={(pos) => {
              setSigPosition(pos);
              setStep("sign");
            }}
            onCancel={() => setStep("review")}
          />
        ) : step === "sign" || step === "confirm" ? (
          /* Signing step */
          <div className="space-y-6">
            {/* Signature placement confirmation */}
            {sigPosition && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                <Icon name="place" size={16} className="text-blue-600 shrink-0" />
                <p className="text-sm text-blue-700">Signature will be placed on page {sigPosition.page + 1}</p>
                <button
                  onClick={() => setStep("place")}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Change position
                </button>
              </div>
            )}

            {/* Signature block — DocuSign style */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Icon name="draw" size={16} className="text-blue-600" />
                  Your Signature
                </h2>
              </div>

              <div className="p-5 space-y-5">
                {/* Draw signature */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Draw your signature</label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white hover:border-blue-400 transition-colors">
                    <canvas
                      ref={canvasRef}
                      width={700}
                      height={180}
                      className="w-full cursor-crosshair touch-none"
                      style={{ height: "140px" }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-sm text-gray-300 italic">Sign here</p>
                      </div>
                    )}
                  </div>
                  {hasDrawn && (
                    <button
                      onClick={clearCanvas}
                      className="mt-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Icon name="undo" size={12} />
                      Clear & redo
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Full name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Full name</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Type your full legal name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                </div>

                {/* Date & Time — auto filled, read-only */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Date</label>
                    <div className="px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 font-medium">
                      {formattedDate}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Time</label>
                    <div className="px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 font-medium">
                      {formattedTime}
                    </div>
                  </div>
                </div>

                {/* Signature preview */}
                {hasDrawn && typedName.trim() && (
                  <>
                    <div className="border-t" />
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Signature preview</label>
                      <div className="border rounded-lg p-4 bg-gray-50 space-y-1">
                        <div className="border-b border-gray-300 pb-2 mb-2">
                          <canvas
                            ref={(el) => {
                              if (!el || !canvasRef.current) return;
                              const ctx = el.getContext("2d");
                              if (!ctx) return;
                              el.width = 200;
                              el.height = 50;
                              ctx.drawImage(canvasRef.current, 0, 0, 200, 50);
                            }}
                            className="h-[50px] w-[200px]"
                          />
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{typedName}</p>
                        <p className="text-xs text-gray-500">{formattedDate} at {formattedTime}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Agreement + Submit */}
            <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  I agree that my electronic signature is the legal equivalent of my handwritten signature and that I have reviewed the document in full.
                </span>
              </label>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                  <Icon name="error" size={16} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!agreed || submitting || !hasDrawn || !typedName.trim()}
                className={cn(
                  "w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2.5 shadow-sm",
                  agreed && hasDrawn && typedName.trim() && !submitting
                    ? "bg-[#4C3ACF] text-white hover:bg-[#3d2ea6] active:scale-[0.99]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <><Icon name="progress_activity" size={18} className="animate-material-spin" />Signing document...</>
                ) : (
                  <><Icon name="draw" size={18} />Adopt Signature & Sign</>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Review step */
          <>
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
              onClick={() => setStep("place")}
              className="w-full py-3.5 rounded-xl bg-[#4C3ACF] text-white font-semibold text-base hover:bg-[#3d2ea6] transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99]"
            >
              <Icon name="draw" size={18} />
              Continue to Sign
            </button>
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

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      try {
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
          setCurrentPage(pdf.numPages - 1);
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
        <Icon name="progress_activity" size={32} className="animate-material-spin text-blue-500 mb-3" />
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
        <Icon name="mouse" size={20} className="text-blue-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">Click where you want your signature placed</p>
          <p className="text-xs text-blue-600 mt-0.5">Your signature block (signature + name + date) will appear at the selected spot.</p>
        </div>
        <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg hover:bg-blue-100 text-blue-400">
          <Icon name="close" size={16} />
        </button>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <Icon name="chevron_left" size={16} />
          </button>
          <span className="text-sm text-gray-600 font-medium">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          >
            <Icon name="chevron_right" size={16} />
          </button>
        </div>
      )}

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
          {hoverPos && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: hoverPos.x - 5,
                top: hoverPos.y - 5,
              }}
            >
              <div className="border-2 border-blue-500 border-dashed rounded bg-blue-500/5 p-2" style={{ width: 200, minHeight: 70 }}>
                <div className="border-b border-blue-300/50 h-8 mb-1 flex items-end">
                  <span className="text-[10px] text-blue-400 italic">Signature</span>
                </div>
                <p className="text-[10px] text-blue-500 font-medium">Full Name</p>
                <p className="text-[8px] text-blue-400">Date & Time</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
