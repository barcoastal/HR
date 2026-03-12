"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FileText, Check, Loader2, PenLine } from "lucide-react";

type SigningData = {
  documentUrl: string;
  documentName: string;
  employeeName: string;
  status: string;
};

export function SigningPage({ token, data }: { token: string; data: SigningData }) {
  const [mode, setMode] = useState<"view" | "sign" | "done">("view");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    try {
      const signatureBase64 = canvas.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureBase64 }),
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
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Signed</h1>
          <p className="text-gray-600">Thanks for signing <strong>{data.documentName}</strong>. A copy has been saved to your file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Document Signing</h1>
        <p className="text-sm text-gray-500">Hi {data.employeeName}, please review and sign the document below.</p>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* PDF Viewer */}
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

        {/* Signature Area */}
        {mode === "view" && (
          <button
            onClick={() => setMode("sign")}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <PenLine className="h-4 w-4" />
            Proceed to Sign
          </button>
        )}

        {mode === "sign" && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
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
              <span className="text-sm text-gray-700">I agree to sign this document</span>
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
      </div>
    </div>
  );
}
