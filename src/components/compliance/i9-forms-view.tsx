"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { addEmployeeDocument, deleteEmployeeDocument } from "@/lib/actions/employee-documents";
import { sortI9Rows, type I9Row } from "@/lib/compliance";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const readable = (value: string) =>
  value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function I9FormsView({ rows }: { rows: I9Row[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortI9Rows(rows).filter(
      (r) =>
        (!onlyMissing || r.documents.length === 0) &&
        (!q || r.name.toLowerCase().includes(q) || r.jobTitle.toLowerCase().includes(q))
    );
  }, [rows, query, onlyMissing]);

  function pickFile(employeeId: string) {
    uploadFor.current = employeeId;
    setError(null);
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const employeeId = uploadFor.current;
    e.target.value = "";
    if (!file || !employeeId) return;
    setBusyId(employeeId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await addEmployeeDocument({
        employeeId,
        name: file.name,
        url: data.url,
        category: "I9",
        visibility: "SUPER_ADMIN_ONLY",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(employeeId: string, docId: string, name: string) {
    if (!confirm(`Delete the I-9 "${name}"? This can't be undone.`)) return;
    setBusyId(employeeId);
    setError(null);
    try {
      await deleteEmployeeDocument(docId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the I-9");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFile}
        aria-hidden
        tabIndex={-1}
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or job title"
            aria-label="Search employees"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text-primary)]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
          />
          Missing an I-9 only
        </label>
      </div>

      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
          {onlyMissing ? "Everyone shown has an I-9 on file." : "No employees match."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {shown.map((row) => {
            const missing = row.documents.length === 0;
            const busy = busyId === row.employeeId;
            return (
              <li key={row.employeeId} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start">
                <div className="min-w-0 md:w-72 md:shrink-0">
                  <Link
                    href={`/people/${row.employeeId}`}
                    className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                  >
                    {row.name}
                  </Link>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {row.jobTitle} · {readable(row.status)} · Starts {formatDate(row.startDate)}
                  </p>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {missing ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Icon name="warning" size={12} />
                      No I-9 on file
                    </span>
                  ) : (
                    row.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 text-sm">
                        <Icon name="description" size={14} className="text-[var(--color-text-muted)] shrink-0" />
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline"
                        >
                          {doc.name}
                        </a>
                        <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatDate(doc.uploadedAt)}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.employeeId, doc.id, doc.name)}
                          disabled={busy}
                          aria-label={`Delete ${doc.name}`}
                          title="Delete this I-9"
                          className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-500 disabled:opacity-50"
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => pickFile(row.employeeId)}
                  disabled={busy}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                    missing
                      ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                      : "border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                  )}
                >
                  <Icon name="upload" size={14} />
                  {busy ? "Working…" : missing ? "Upload I-9" : "Add file"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
