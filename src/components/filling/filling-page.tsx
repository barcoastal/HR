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

type DetectedField = {
  id: string;
  label: string;
  type: "text" | "date" | "ssn" | "phone" | "email" | "number" | "checkbox";
  page: number;
  xPercent: number;
  yPercent: number;
  required: boolean;
  section?: string;
};

type FillingData = {
  fields: FormField[];
  detectedFields: DetectedField[];
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
  const hasAcroFields = data.fields.length > 0;
  const hasDetectedFields = data.detectedFields.length > 0;
  const useSmartForm = !hasAcroFields && hasDetectedFields;

  const [step, setStep] = useState<"review" | "fill" | "sign" | "confirm" | "done">("review");
  const [acroValues, setAcroValues] = useState<Record<string, string>>({});
  const [detectedValues, setDetectedValues] = useState<Record<string, string>>({});
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasAcroFields) {
      const initial: Record<string, string> = {};
      for (const field of data.fields) initial[field.name] = field.value || "";
      setAcroValues(initial);
    }
    if (hasDetectedFields) {
      const initial: Record<string, string> = {};
      for (const field of data.detectedFields) initial[field.id] = "";
      setDetectedValues(initial);
    }
  }, [data.fields, data.detectedFields, hasAcroFields, hasDetectedFields]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Build text overlays from detected fields
      const textOverlays = useSmartForm
        ? data.detectedFields
            .filter((f) => detectedValues[f.id]?.trim())
            .map((f) => ({
              page: f.page,
              xPercent: f.xPercent,
              yPercent: f.yPercent,
              text: detectedValues[f.id],
            }))
        : [];

      const res = await fetch(`/api/fill/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues: hasAcroFields ? acroValues : {},
          textOverlays,
          signatureBase64: signatureBase64 || undefined,
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

  const formattedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Done screen ──
  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Completed</h1>
          <p className="text-gray-600 mb-4">
            You have successfully filled out and signed <strong>{data.documentName}</strong>.
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{data.documentName}</h1>
            <p className="text-xs text-gray-500">{data.employeeName}</p>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1 shrink-0">
            {(useSmartForm ? ["Review", "Fill", "Sign", "Confirm"] : ["Review", "Fill"]).map((label, i) => {
              const steps = useSmartForm ? ["review", "fill", "sign", "confirm"] : ["review", "fill"];
              const current = steps.indexOf(step);
              return (
                <div key={label} className={cn(
                  "w-2 h-2 rounded-full",
                  i === current ? "bg-teal-500" : i < current ? "bg-teal-300" : "bg-gray-200"
                )} />
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {/* ── Review step ── */}
        {step === "review" && (
          <>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-4 flex items-start gap-3">
              <Icon name="waving_hand" size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-900">Hi {data.employeeName},</p>
                <p className="text-sm text-teal-700 mt-0.5">Review the document, then fill out the form.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border mb-4">
              <div className="p-3">
                <iframe
                  src={data.documentUrl}
                  className="w-full rounded border"
                  style={{ height: "55vh" }}
                  title="Document Preview"
                />
              </div>
            </div>

            <button
              onClick={() => setStep("fill")}
              className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Icon name="edit_document" size={18} />
              Continue to Fill Out
            </button>
          </>
        )}

        {/* ── Fill step ── */}
        {step === "fill" && (
          <div className="space-y-4">
            {hasAcroFields ? (
              <AcroFormFields
                fields={data.fields}
                values={acroValues}
                onChange={(name, val) => setAcroValues((p) => ({ ...p, [name]: val }))}
              />
            ) : hasDetectedFields ? (
              <SmartFormFields
                fields={data.detectedFields}
                values={detectedValues}
                onChange={(id, val) => setDetectedValues((p) => ({ ...p, [id]: val }))}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
                <Icon name="warning" size={32} className="text-amber-500 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">Could not detect form fields</p>
                <p className="text-sm text-gray-500 mt-1">Please contact HR for assistance.</p>
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
                onClick={() => setStep("review")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (useSmartForm) {
                    setStep("sign");
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {useSmartForm ? (
                  <><Icon name="draw" size={16} />Continue to Sign</>
                ) : submitting ? (
                  <><Icon name="progress_activity" size={16} className="animate-material-spin" />Submitting...</>
                ) : (
                  <><Icon name="check_circle" size={16} />Submit</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Sign step ── */}
        {step === "sign" && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="draw" size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <p className="text-sm text-teal-700">Draw your signature below to complete the form.</p>
            </div>

            <SignaturePad
              name={data.employeeName}
              onSignature={setSignatureBase64}
            />

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("fill")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep("confirm")}
                disabled={!signatureBase64}
                className={cn(
                  "flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm",
                  signatureBase64
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <Icon name="preview" size={16} />
                Review & Submit
              </button>
            </div>
          </div>
        )}

        {/* ── Confirm step ── */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="fact_check" size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">Please review your answers below before submitting.</p>
            </div>

            {/* Review answers */}
            {useSmartForm && (() => {
              const sections = new Map<string, typeof data.detectedFields>();
              for (const f of data.detectedFields) {
                const sec = f.section || "General";
                if (!sections.has(sec)) sections.set(sec, []);
                sections.get(sec)!.push(f);
              }
              return Array.from(sections.entries()).map(([section, fields]) => {
                const filledFields = fields.filter((f) => detectedValues[f.id]?.trim());
                if (filledFields.length === 0) return null;
                return (
                  <div key={section} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{section}</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {filledFields.map((f) => (
                        <div key={f.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                          <span className="text-xs text-gray-500 shrink-0">{f.label}</span>
                          <span className="text-sm text-gray-900 font-medium text-right truncate">{detectedValues[f.id]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}

            {hasAcroFields && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Form Fields</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {data.fields.filter((f) => acroValues[f.name]?.trim()).map((f) => (
                    <div key={f.name} className="px-4 py-2.5 flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-500 shrink-0">{formatFieldLabel(f.name)}</span>
                      <span className="text-sm text-gray-900 font-medium text-right truncate">
                        {f.type === "checkbox" ? (acroValues[f.name] === "true" ? "Yes" : "No") : acroValues[f.name]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature preview */}
            {signatureBase64 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Signature</h3>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <img src={signatureBase64} alt="Your signature" className="h-12 border-b border-gray-200" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{data.employeeName}</p>
                    <p className="text-xs text-gray-500">{formattedDate}</p>
                  </div>
                </div>
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
                onClick={() => setStep("sign")}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back
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

// ── AcroForm fields (original mode) ──

function AcroFormFields({ fields, values, onChange }: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="edit_document" size={16} className="text-teal-600" />
          Form Fields
        </h2>
      </div>
      <div className="p-4 space-y-4">
        {fields.map((field) => (
          <FieldInput
            key={field.name}
            label={formatFieldLabel(field.name)}
            type={field.type === "text" ? "text" : field.type}
            value={values[field.name] || ""}
            onChange={(v) => onChange(field.name, v)}
            options={field.options}
          />
        ))}
      </div>
    </div>
  );
}

// ── Smart form fields (Claude-detected) ──

function SmartFormFields({ fields, values, onChange }: {
  fields: DetectedField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  // Group by section
  const sections = new Map<string, DetectedField[]>();
  for (const f of fields) {
    const section = f.section || "General";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(f);
  }

  return (
    <div className="space-y-4">
      {Array.from(sections.entries()).map(([section, sectionFields]) => (
        <div key={section} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-gray-900">{section}</h2>
          </div>
          <div className="p-4 space-y-4">
            {sectionFields.map((field) => (
              <FieldInput
                key={field.id}
                label={field.label}
                type={field.type}
                value={values[field.id] || ""}
                onChange={(v) => onChange(field.id, v)}
                required={field.required}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Generic field input ──

function FieldInput({ label, type, value, onChange, required, options }: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  options?: string[];
}) {
  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500";

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {type === "checkbox" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-gray-700">Yes</span>
        </label>
      ) : type === "dropdown" && options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : type === "radio" && options ? (
        <div className="flex flex-wrap gap-3">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4 border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type={type === "date" ? "date" : type === "email" ? "email" : type === "phone" ? "tel" : type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            type === "ssn" ? "XXX-XX-XXXX" :
            type === "phone" ? "(XXX) XXX-XXXX" :
            type === "date" ? "MM/DD/YYYY" :
            undefined
          }
          inputMode={type === "phone" || type === "ssn" || type === "number" ? "numeric" : undefined}
          className={inputClass}
        />
      )}
    </div>
  );
}

// ── Signature pad ──

function SignaturePad({ name, onSignature }: { name: string; onSignature: (base64: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a2e";
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    if (canvasRef.current && hasDrawn) {
      onSignature(canvasRef.current.toDataURL("image/png"));
    }
  }, [hasDrawn, onSignature]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      onSignature(null);
    }
  };

  const formattedDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="draw" size={16} className="text-teal-600" />
          Your Signature
        </h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={150}
            className="w-full cursor-crosshair touch-none"
            style={{ height: "120px" }}
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
            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <Icon name="undo" size={12} />
            Clear & redo
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{name}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border text-sm text-gray-700 font-medium">{formattedDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
