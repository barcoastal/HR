"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type FormField = {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "radio";
  value: string;
  options?: string[];
};

type FillingData = {
  fields: FormField[];
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
  const [step, setStep] = useState<"review" | "fill" | "done">("review");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of data.fields) {
      initial[field.name] = field.value || "";
    }
    setFieldValues(initial);
  }, [data.fields]);

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
        body: JSON.stringify({ fieldValues }),
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
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-100">
              <Icon name="info" size={16} className="text-teal-600 shrink-0" />
              <p className="text-sm text-teal-700">Fill in all the fields below. You can scroll up to review the document if needed.</p>
              <button
                onClick={() => setStep("review")}
                className="ml-auto text-xs text-teal-600 hover:text-teal-800 font-medium underline"
              >
                Back to review
              </button>
            </div>

            {data.fields.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                <Icon name="warning" size={32} className="text-amber-500 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">No fillable fields found</p>
                <p className="text-sm text-gray-500 mt-1">This PDF does not contain fillable form fields. Please contact HR for assistance.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Icon name="edit_document" size={16} className="text-teal-600" />
                    Form Fields ({data.fields.length})
                  </h2>
                </div>

                <div className="p-5 space-y-4">
                  {data.fields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        {formatFieldLabel(field.name)}
                      </label>

                      {field.type === "text" && (
                        <input
                          type="text"
                          value={fieldValues[field.name] || ""}
                          onChange={(e) => updateField(field.name, e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                        />
                      )}

                      {field.type === "checkbox" && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fieldValues[field.name] === "true"}
                            onChange={(e) => updateField(field.name, e.target.checked ? "true" : "false")}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Yes</span>
                        </label>
                      )}

                      {field.type === "dropdown" && (
                        <select
                          value={fieldValues[field.name] || ""}
                          onChange={(e) => updateField(field.name, e.target.value)}
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
                                onChange={() => updateField(field.name, opt)}
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
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <Icon name="error" size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {data.fields.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "w-full py-3.5 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2.5 shadow-sm",
                  !submitting
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
