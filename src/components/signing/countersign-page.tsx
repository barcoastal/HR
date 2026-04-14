"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { submitCountersignature } from "@/lib/actions/countersign";

type Placement = {
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  kind: "signature" | "signatureDate" | "countersignature" | "countersignatureDate";
};

export function CountersignPage({
  requestId,
  documentName,
  documentUrl,
  signerName,
  placements,
}: {
  requestId: string;
  documentName: string;
  documentUrl: string;
  signerName: string;
  placements: Placement[];
}) {
  const router = useRouter();
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const countersigCount = placements.filter((p) => p.kind === "countersignature").length;

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

  const endDraw = useCallback(() => { isDrawing.current = false; }, []);

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
    try {
      const signatureBase64 = canvas.toDataURL("image/png");
      const result = await submitCountersignature(requestId, signatureBase64, typedName.trim());
      if (result.success) {
        router.push("/sign-queue?signed=1");
      } else {
        setError(result.error || "Failed to submit countersignature");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link href="/sign-queue" className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1 mb-4">
        <Icon name="arrow_back" size={14} /> Back to Sign Queue
      </Link>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 mb-5 flex items-start gap-3">
        <Icon name="verified" size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Countersign request</p>
          <p className="text-xs text-amber-800 mt-0.5">
            <strong>{signerName}</strong> has signed <strong>{documentName}</strong>. Your signature will be placed at {countersigCount} pre-marked spot{countersigCount !== 1 ? "s" : ""} to complete the document.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Document preview */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-gray-50">
            <Icon name="description" size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate">{documentName}</span>
          </div>
          <iframe src={documentUrl} className="w-full" style={{ height: "70vh" }} title={documentName} />
        </div>

        {/* Signature panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Icon name="draw" size={16} className="text-amber-600" />
              Your signature
            </h2>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Draw signature</label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
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
                <button onClick={clearCanvas} className="mt-1 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <Icon name="undo" size={12} /> Clear
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Full name</label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your full name"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Date</label>
              <div className="px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm">
                {formattedDate}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
              />
              <span>I confirm this is my electronic signature and I have reviewed the document.</span>
            </label>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={14} className="text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!agreed || submitting || !hasDrawn || !typedName.trim()}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
                agreed && hasDrawn && typedName.trim() && !submitting
                  ? "bg-[var(--color-accent)] text-white hover:opacity-90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              {submitting ? <><Icon name="progress_activity" size={16} className="animate-material-spin" />Submitting…</> : <><Icon name="verified" size={16} />Countersign & Complete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
