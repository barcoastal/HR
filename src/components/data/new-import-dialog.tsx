"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

export function NewImportDialog() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setError("Choose a .csv or .xlsx file.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/data/imports", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Upload failed.");
        return;
      }
      router.push(`/data/imports/${body.id}`);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
        )}
      >
        <Icon name="upload" size={16} /> New import
      </button>
      <Dialog open={open} onClose={() => !uploading && setOpen(false)} title="Import people from a file">
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Nothing is saved to the system yet. You&apos;ll map columns and review possible duplicates before importing.
          </p>
          <div
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) upload(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-8 rounded-lg cursor-pointer transition-colors border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            {uploading ? (
              <>
                <Icon name="progress_activity" size={32} className="animate-material-spin text-[var(--color-accent)]" />
                <span className="text-sm">Reading file…</span>
              </>
            ) : (
              <>
                <Icon name="table_chart" size={32} className="text-[var(--color-text-muted)]" />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Drop a CSV or Excel file here, or click to browse
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  First row must be column headers. Required: first and last name.
                </span>
              </>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
