"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { startGustoImport } from "@/lib/actions/imports";

type Busy = "upload" | "gusto" | null;

export function NewImportDialog({ gustoConnected }: { gustoConnected: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    if (busy) return;
    setError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setError("Choose a .csv or .xlsx file.");
      return;
    }
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/data/imports", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Upload failed.");
        setBusy(null);
        return;
      }
      // Stay busy until the batch page takes over, so the dialog does not flash back to idle.
      router.push(`/data/imports/${body.id}`);
    } catch {
      setError("Upload failed. Please try again.");
      setBusy(null);
    }
  }

  async function pullFromGusto() {
    if (busy) return;
    setError(null);
    setBusy("gusto");
    try {
      const { id } = await startGustoImport();
      router.push(`/data/imports/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Gusto. Please try again.");
      setBusy(null);
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
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={gustoConnected ? "Import people" : "Import people from a file"}
      >
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
            onClick={() => !busy && inputRef.current?.click()}
            aria-disabled={busy === "gusto"}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-8 rounded-lg transition-colors border-2 border-dashed border-[var(--color-border)]",
              busy === "gusto"
                ? "opacity-50 pointer-events-none"
                : "cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]",
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
            {busy === "upload" ? (
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

          {gustoConnected && (
            <>
              <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden />
                or
                <span className="h-px flex-1 bg-[var(--color-border)]" aria-hidden />
              </div>

              <button
                type="button"
                onClick={pullFromGusto}
                disabled={busy !== null}
                className={cn(
                  "w-full flex items-start gap-3 p-4 rounded-lg text-left transition-colors border border-[var(--color-border)] bg-[var(--color-surface)]",
                  "hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] disabled:pointer-events-none",
                  busy === "upload" && "opacity-50",
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  {busy === "gusto" ? (
                    <Icon name="progress_activity" size={20} className="animate-material-spin" />
                  ) : (
                    <Icon name="cloud_download" size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                    {busy === "gusto" ? "Pulling from Gusto…" : "Pull from Gusto"}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                    Creates a review batch from everyone in Gusto — terminated people excluded. Nothing is saved until you
                    review and import.
                  </span>
                </span>
                {busy !== "gusto" && (
                  <Icon name="arrow_forward" size={18} className="mt-2 shrink-0 text-[var(--color-text-muted)]" />
                )}
              </button>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
