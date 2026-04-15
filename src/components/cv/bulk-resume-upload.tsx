"use client";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";

type Position = { id: string; title: string };

type FileEntry = {
  file: File;
  folder: string;
  status: "queued" | "uploading" | "done" | "error" | "skipped";
  message?: string;
  resultStatus?: "created" | "merged" | "skipped";
  doNotCall?: boolean;
  applicationCount?: number;
};

function folderOf(f: File): string {
  // webkitRelativePath: "FolderName/file.pdf" or "Parent/Sub/file.pdf"
  // We use the first path segment (top-level folder) so "FolderA/sub/x.pdf" groups under FolderA.
  const raw = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  const parts = raw.split("/").filter(Boolean);
  if (parts.length <= 1) return "(loose files)";
  return parts[0];
}

function guessPosition(folderName: string, positions: Position[]): string {
  const norm = folderName.toLowerCase();
  const match = positions.find((p) => {
    const t = p.title.toLowerCase();
    return norm.includes(t) || t.includes(norm);
  });
  return match?.id ?? "";
}

export function BulkResumeUpload({ positions }: { positions: Position[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [folderToPosition, setFolderToPosition] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.folder);
    return Array.from(set).sort();
  }, [entries]);

  const stats = useMemo(() => {
    let queued = 0, uploading = 0, created = 0, merged = 0, skipped = 0, errored = 0, dnc = 0;
    for (const e of entries) {
      if (e.status === "queued") queued++;
      else if (e.status === "uploading") uploading++;
      else if (e.status === "error") errored++;
      else if (e.status === "skipped") skipped++;
      else if (e.status === "done") {
        if (e.resultStatus === "created") created++;
        else if (e.resultStatus === "merged") merged++;
        else if (e.resultStatus === "skipped") skipped++;
      }
      if (e.doNotCall) dnc++;
    }
    return { queued, uploading, created, merged, skipped, errored, dnc, total: entries.length };
  }, [entries]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const picked: FileEntry[] = [];
    const folderMap: Record<string, string> = { ...folderToPosition };
    for (const f of Array.from(fileList)) {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) continue;
      const folder = folderOf(f);
      picked.push({ file: f, folder, status: "queued" });
      if (!(folder in folderMap)) folderMap[folder] = guessPosition(folder, positions);
    }
    setEntries((prev) => [...prev, ...picked]);
    setFolderToPosition(folderMap);
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function startUpload() {
    if (uploading) return;
    setUploading(true);
    setStopRequested(false);

    const CONCURRENCY = 4;
    const queue = entries.map((_, i) => i).filter((i) => entries[i].status === "queued");
    let cursor = 0;

    async function worker() {
      while (!stopRequested) {
        const myIndex = cursor++;
        if (myIndex >= queue.length) return;
        const idx = queue[myIndex];
        const entry = entries[idx];
        if (!entry) continue;

        setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, status: "uploading" } : e));

        const positionId = folderToPosition[entry.folder] || "";
        const positionTitle = positions.find((p) => p.id === positionId)?.title || entry.folder;

        const fd = new FormData();
        fd.append("file", entry.file);
        fd.append("positionId", positionId);
        fd.append("positionName", positionTitle);
        fd.append("source", "bulk-upload");

        try {
          const res = await fetch("/api/candidates/bulk-upload", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, status: "error", message: data?.error || `HTTP ${res.status}` } : e));
            continue;
          }
          setEntries((prev) => prev.map((e, i) => i === idx ? {
            ...e,
            status: data.status === "skipped" ? "skipped" : "done",
            resultStatus: data.status,
            message: data.reason || data.name || data.email,
            doNotCall: !!data.doNotCall,
            applicationCount: data.applicationCount,
          } : e));
        } catch (err) {
          setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, status: "error", message: err instanceof Error ? err.message : "Network error" } : e));
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    setUploading(false);
    router.refresh();
  }

  function stopUpload() {
    setStopRequested(true);
  }

  function resetAll() {
    setEntries([]);
    setFolderToPosition({});
    setStopRequested(false);
  }

  const allMapped = folders.length > 0 && folders.every((f) => folderToPosition[f]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20",
          "border border-[var(--color-accent)]/30 transition-colors"
        )}
      >
        <Icon name="folder_zip" size={16} />
        Bulk upload resumes
      </button>

      <Dialog open={open} onClose={() => !uploading && setOpen(false)} title="Bulk upload resumes">
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div
              className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-10 text-center cursor-pointer hover:border-[var(--color-accent)]/50"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="folder_open" size={32} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Drop folders here or click to select</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Each sub-folder = one position. PDFs are extracted with AI; duplicates are merged by email.
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </div>
          ) : (
            <>
              {/* Folder → position mapping */}
              <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {folders.map((folder) => {
                  const count = entries.filter((e) => e.folder === folder).length;
                  return (
                    <div key={folder} className="flex items-center gap-3 p-3">
                      <Icon name="folder" size={16} className="text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{folder}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{count} PDF{count !== 1 ? "s" : ""}</p>
                      </div>
                      <select
                        value={folderToPosition[folder] || ""}
                        onChange={(e) => setFolderToPosition((p) => ({ ...p, [folder]: e.target.value }))}
                        disabled={uploading}
                        className="px-2.5 py-1.5 rounded text-xs bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] min-w-[220px]"
                      >
                        <option value="">Select position…</option>
                        {positions.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="rounded-lg bg-[var(--color-background)] p-2 border border-[var(--color-border)]">
                  <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Total</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)]">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
                  <p className="text-[10px] uppercase text-emerald-700">New</p>
                  <p className="text-base font-bold text-emerald-700">{stats.created}</p>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-2 border border-blue-500/20">
                  <p className="text-[10px] uppercase text-blue-700">Merged</p>
                  <p className="text-base font-bold text-blue-700">{stats.merged}</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2 border border-red-500/20">
                  <p className="text-[10px] uppercase text-red-700">DNC hit</p>
                  <p className="text-base font-bold text-red-700">{stats.dnc}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2 border border-amber-500/20">
                  <p className="text-[10px] uppercase text-amber-700">Errors</p>
                  <p className="text-base font-bold text-amber-700">{stats.errored + stats.skipped}</p>
                </div>
              </div>

              {/* File list */}
              <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <StatusIcon status={e.status} />
                    <span className="text-[var(--color-text-muted)] w-24 truncate shrink-0">{e.folder}</span>
                    <span className="flex-1 min-w-0 truncate text-[var(--color-text-primary)]">{e.file.name}</span>
                    {e.doNotCall && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 font-semibold">DO NOT CALL</span>
                    )}
                    {e.applicationCount && e.applicationCount > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700">{e.applicationCount}× applied</span>
                    )}
                    {e.message && (
                      <span className="text-[var(--color-text-muted)] truncate max-w-[40%]" title={e.message}>{e.message}</span>
                    )}
                    {!uploading && e.status === "queued" && (
                      <button onClick={() => removeEntry(i)} className="text-[var(--color-text-muted)] hover:text-red-500">
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                >
                  + Add more files/folders
                </button>
                <div className="flex items-center gap-2">
                  {!uploading ? (
                    <>
                      <button onClick={resetAll} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                        Clear
                      </button>
                      <button
                        onClick={startUpload}
                        disabled={!allMapped || entries.every((e) => e.status !== "queued")}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2",
                          allMapped && entries.some((e) => e.status === "queued")
                            ? "bg-[var(--color-accent)] text-white hover:opacity-90"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        <Icon name="upload" size={14} />
                        Start upload ({entries.filter((e) => e.status === "queued").length})
                      </button>
                    </>
                  ) : (
                    <button onClick={stopUpload} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 flex items-center gap-2">
                      <Icon name="stop" size={14} /> Stop
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                multiple
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}

function StatusIcon({ status }: { status: FileEntry["status"] }) {
  if (status === "uploading") return <Icon name="progress_activity" size={12} className="animate-material-spin text-[var(--color-accent)]" />;
  if (status === "done") return <Icon name="check_circle" size={12} className="text-emerald-500" />;
  if (status === "error") return <Icon name="error" size={12} className="text-red-500" />;
  if (status === "skipped") return <Icon name="remove_circle" size={12} className="text-amber-500" />;
  return <Icon name="schedule" size={12} className="text-[var(--color-text-muted)]" />;
}
