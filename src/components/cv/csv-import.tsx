"use client";

import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { bulkImportCandidates } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";

type CandidateField = "firstName" | "lastName" | "email" | "phone" | "skills" | "experience" | "source" | "linkedinUrl" | "notes" | "skip";

const FIELD_OPTIONS: { value: CandidateField; label: string }[] = [
  { value: "skip", label: "(Skip)" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "skills", label: "Skills" },
  { value: "experience", label: "Experience" },
  { value: "source", label: "Source" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "notes", label: "Notes" },
];

const HEADER_MAP: Record<string, CandidateField> = {
  "first name": "firstName", "firstname": "firstName", "first": "firstName", "given name": "firstName",
  "last name": "lastName", "lastname": "lastName", "last": "lastName", "surname": "lastName", "family name": "lastName",
  "email": "email", "e-mail": "email", "email address": "email",
  "phone": "phone", "phone number": "phone", "telephone": "phone", "mobile": "phone",
  "skills": "skills", "skill": "skills",
  "experience": "experience", "years of experience": "experience", "exp": "experience",
  "source": "source", "referral source": "source",
  "linkedin": "linkedinUrl", "linkedin url": "linkedinUrl", "linkedin profile": "linkedinUrl",
  "notes": "notes", "note": "notes", "comments": "notes", "comment": "notes",
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map(splitRow).filter((r) => r.some((c) => c));
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): CandidateField[] {
  return headers.map((h) => {
    const normalized = h.toLowerCase().trim();
    return HEADER_MAP[normalized] || "skip";
  });
}

export function CsvImport() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CandidateField[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setFileName("");
    setResult(null);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h);
      setRows(r);
      setMapping(autoDetectMapping(h));
      setStep(2);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function updateMapping(index: number, value: CandidateField) {
    setMapping((m) => m.map((v, i) => (i === index ? value : v)));
  }

  const hasRequired = mapping.includes("firstName") && mapping.includes("lastName") && mapping.includes("email");

  async function handleImport() {
    setImporting(true);
    const candidates = rows.map((row) => {
      const entry: Record<string, string> = {};
      mapping.forEach((field, i) => {
        if (field !== "skip" && row[i]) entry[field] = row[i];
      });
      return entry;
    }).filter((e) => e.firstName && e.lastName && e.email);

    const payload = candidates.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone || undefined,
      skills: c.skills ? c.skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean).join(", ") : undefined,
      experience: c.experience || undefined,
      source: c.source || undefined,
      linkedinUrl: c.linkedinUrl || undefined,
      notes: c.notes || undefined,
    }));

    try {
      const res = await bulkImportCandidates(payload);
      setResult({ created: res.created, skipped: res.skipped.length, errors: res.errors });
      setStep(3);
    } catch {
      setResult({ created: 0, skipped: 0, errors: ["Import failed. Please try again."] });
      setStep(3);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    if (result && result.created > 0) router.refresh();
    setTimeout(reset, 200);
  }

  const selectClass = cn(
    "w-full px-2 py-1.5 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const previewRows = rows.slice(0, 3);

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "hover:bg-[var(--color-surface-hover)] transition-colors"
        )}
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </button>

      <Dialog open={open} onClose={handleClose} title="Import Candidates from CSV">
        {step === 1 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-8 rounded-lg cursor-pointer transition-colors",
              "border-2 border-dashed border-[var(--color-border)]",
              "hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <FileSpreadsheet className="h-8 w-8 text-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-primary)] font-medium">
              Drop a CSV file here or click to browse
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              First row should contain column headers
            </span>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{fileName}</span>
              <span className="ml-auto">{rows.length} rows found</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">Map columns to candidate fields:</p>
              {headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-text-muted)] w-32 truncate shrink-0" title={header}>
                    {header}
                  </span>
                  <select
                    value={mapping[i]}
                    onChange={(e) => updateMapping(i, e.target.value as CandidateField)}
                    className={selectClass}
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {previewRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Preview (first {previewRows.length} rows):</p>
                <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-background)]">
                        {headers.map((h, i) => (
                          <th key={i} className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-t border-[var(--color-border)]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap max-w-[150px] truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!hasRequired && (
              <p className="text-xs text-red-500">
                Please map First Name, Last Name, and Email columns to proceed.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!hasRequired || importing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-[var(--color-accent)] text-white",
                  "hover:bg-[var(--color-accent-hover)]",
                  "disabled:opacity-50"
                )}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {rows.length} candidates</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              ) : (
                <AlertCircle className="h-10 w-10 text-amber-500" />
              )}
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Import Complete
              </p>
            </div>

            <div className="space-y-2 rounded-lg bg-[var(--color-background)] p-4 border border-[var(--color-border)]">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Created</span>
                <span className="font-medium text-[var(--color-text-primary)]">{result.created}</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Skipped (duplicates)</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{result.skipped}</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-red-500 mb-1">Errors:</p>
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400 truncate" title={err}>{err}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-[var(--color-accent)] text-white",
                  "hover:bg-[var(--color-accent-hover)]"
                )}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
