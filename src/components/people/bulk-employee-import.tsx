"use client";

import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { bulkImportEmployees } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type EmployeeField = "firstName" | "lastName" | "email" | "jobTitle" | "phone" | "department" | "location" | "startDate" | "reportsTo" | "skip";

const FIELD_OPTIONS: { value: EmployeeField; label: string }[] = [
  { value: "skip", label: "(Skip)" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "jobTitle", label: "Job Title" },
  { value: "phone", label: "Phone" },
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "startDate", label: "Start Date" },
  { value: "reportsTo", label: "Reports To" },
];

const HEADER_MAP: Record<string, EmployeeField> = {
  "first name": "firstName", "firstname": "firstName", "first": "firstName", "given name": "firstName",
  "last name": "lastName", "lastname": "lastName", "last": "lastName", "surname": "lastName", "family name": "lastName",
  "email": "email", "e-mail": "email", "email address": "email", "work email": "email",
  "phone": "phone", "phone number": "phone", "telephone": "phone", "mobile": "phone",
  "job title": "jobTitle", "jobtitle": "jobTitle", "title": "jobTitle", "position": "jobTitle", "role": "jobTitle", "primary job title": "jobTitle",
  "department": "department", "dept": "department", "current department": "department", "team": "department",
  "location": "location", "office": "location", "city": "location",
  "start date": "startDate", "startdate": "startDate", "hire date": "startDate", "hiredate": "startDate", "date hired": "startDate", "employee start date": "startDate",
  "reports to": "reportsTo", "reportsto": "reportsTo", "manager": "reportsTo", "manager name": "reportsTo", "direct manager": "reportsTo", "supervisor": "reportsTo", "reporting to": "reportsTo",
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
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { cells.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    cells.push(current.trim());
    return cells;
  }

  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map(splitRow).filter((r) => r.some((c) => c));
  return { headers, rows };
}

function autoDetectMapping(headers: string[]): EmployeeField[] {
  return headers.map((h) => HEADER_MAP[h.toLowerCase().trim()] || "skip");
}

type Department = { id: string; name: string };

export function BulkEmployeeImport({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<EmployeeField[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [selectedDept, setSelectedDept] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStep(1); setHeaders([]); setRows([]); setMapping([]);
    setFileName(""); setResult(null); setSelectedDept("");
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h); setRows(r); setMapping(autoDetectMapping(h)); setStep(2);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function updateMapping(index: number, value: EmployeeField) {
    setMapping((m) => m.map((v, i) => (i === index ? value : v)));
  }

  const hasRequired = mapping.includes("firstName") && mapping.includes("lastName");
  const hasDeptFromCsv = mapping.includes("department");

  async function handleImport() {
    setImporting(true);
    const employees = rows.map((row) => {
      const entry: Record<string, string> = {};
      mapping.forEach((field, i) => {
        if (field !== "skip" && row[i]) entry[field] = row[i];
      });
      return entry;
    }).filter((e) => e.firstName && e.lastName);

    const payload = employees.map((e) => ({
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email || undefined,
      jobTitle: e.jobTitle || undefined,
      phone: e.phone || undefined,
      departmentName: e.department || undefined,
      departmentId: (!hasDeptFromCsv && selectedDept) ? selectedDept : undefined,
      startDate: e.startDate || undefined,
      location: e.location || undefined,
      reportsTo: e.reportsTo || undefined,
    }));

    try {
      const res = await bulkImportEmployees(payload);
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

  const inputClass = cn(
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
        <Icon name="upload" size={16} />
        Bulk Import
      </button>

      <Dialog open={open} onClose={handleClose} title="Import Employees from CSV">
        {step === 1 && (
          <div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-4">
              <p className="text-xs text-amber-400 font-medium">
                Employees will be imported as Pending. No invitations will be sent until you approve them.
              </p>
            </div>
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Icon name="table_chart" size={32} className="text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-primary)] font-medium">
                Drop a CSV file here or click to browse
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Required: First Name, Last Name (Email optional)
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon name="table_chart" size={16} />
              <span>{fileName}</span>
              <span className="ml-auto">{rows.length} rows found</span>
            </div>

            {!hasDeptFromCsv && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                  Assign all to department (optional)
                </label>
                <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className={inputClass}>
                  <option value="">No department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">Map columns to employee fields:</p>
              {headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-text-muted)] w-32 truncate shrink-0" title={header}>
                    {header}
                  </span>
                  <select
                    value={mapping[i]}
                    onChange={(e) => updateMapping(i, e.target.value as EmployeeField)}
                    className={inputClass}
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
                          <th key={i} className="px-2 py-1.5 text-left font-medium text-[var(--color-text-muted)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-t border-[var(--color-border)]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-[var(--color-text-primary)] whitespace-nowrap max-w-[150px] truncate">{cell}</td>
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
                Please map First Name and Last Name columns to proceed.
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
                  <><Icon name="progress_activity" size={16} className="animate-material-spin" /> Importing...</>
                ) : (
                  <>Import {rows.length} as Pending</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              {result.errors.length === 0 ? (
                <Icon name="check_circle" size={40} className="text-emerald-500" />
              ) : (
                <Icon name="error" size={40} className="text-amber-500" />
              )}
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Import Complete</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Employees are in Pending status. Approve them to send invitations.
              </p>
            </div>

            <div className="space-y-2 rounded-lg bg-[var(--color-background)] p-4 border border-[var(--color-border)]">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Created (pending)</span>
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
                className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]")}
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
