"use client";

import { cn, timeAgo } from "@/lib/utils";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { SyncProgressEvent } from "@/lib/platform-sync/types";

type SyncablePlatform = {
  id: string;
  name: string;
  type: string;
  status: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  totalSynced: number;
};

type SyncResult = {
  success: boolean;
  created: number;
  updated: number;
  resumesDownloaded: number;
  resumesFailed: number;
  total: number;
  error?: string;
};

type Props = {
  platforms: SyncablePlatform[];
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-400",
  PAUSED: "bg-amber-400",
  DISCONNECTED: "bg-red-400",
};

export function PlatformSyncPanel({ platforms }: Props) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultPlatformName, setResultPlatformName] = useState("");
  const [confirmPurge, setConfirmPurge] = useState<SyncablePlatform | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const router = useRouter();

  const connected = platforms.filter((p) => p.isConnected);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  if (connected.length === 0) return null;

  function startSync(platform: SyncablePlatform, purge: boolean) {
    setSyncingId(platform.id);
    setProgress(null);
    setResultPlatformName(platform.name);
    setConfirmPurge(null);

    const params = new URLSearchParams({
      platformId: platform.id,
      force: "1",
    });
    if (purge) params.set("purge", "1");

    const es = new EventSource(`/api/platforms/sync-stream?${params}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data: SyncProgressEvent = JSON.parse(event.data);
      setProgress(data);

      if (data.type === "complete") {
        es.close();
        eventSourceRef.current = null;
        setSyncingId(null);
        setResult({
          success: true,
          created: data.created,
          updated: data.updated || 0,
          resumesDownloaded: data.resumesDownloaded || 0,
          resumesFailed: data.resumesFailed || 0,
          total: data.fetched,
        });
        router.refresh();
      } else if (data.type === "error") {
        es.close();
        eventSourceRef.current = null;
        setSyncingId(null);
        setResult({
          success: false,
          created: 0,
          updated: 0,
          resumesDownloaded: 0,
          resumesFailed: 0,
          total: 0,
          error: data.detail ?? "Sync failed",
        });
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setSyncingId(null);
      setResult({
        success: false,
        created: 0,
        updated: 0,
        resumesDownloaded: 0,
        resumesFailed: 0,
        total: 0,
        error: "Connection lost during sync",
      });
    };
  }

  function closeResult() {
    setResult(null);
    setResultPlatformName("");
    setProgress(null);
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Sync from Platforms
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {connected.map((p) => {
          const isSyncing = syncingId === p.id;
          const statusColor = STATUS_COLORS[p.status] || STATUS_COLORS.DISCONNECTED;
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl p-4",
                "bg-[var(--color-surface)] border border-[var(--color-border)]"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("h-2 w-2 rounded-full shrink-0", statusColor)} />
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {p.name}
                </p>
              </div>
              <div className="space-y-1 mb-3">
                {p.lastSyncAt ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Last sync: {timeAgo(p.lastSyncAt)}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">Never synced</p>
                )}
                <p className="text-xs text-[var(--color-text-muted)]">
                  {p.totalSynced} candidate{p.totalSynced !== 1 ? "s" : ""} imported
                </p>
              </div>

              {/* Progress bar during sync */}
              {isSyncing && progress && (
                <div className="mb-3 space-y-1.5">
                  <div className="w-full h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                      style={{
                        width: progress.total > 0
                          ? `${Math.min(100, (progress.fetched / progress.total) * 100)}%`
                          : "100%",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {progress.detail || `${progress.fetched}/${progress.total}`}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => startSync(p, false)}
                  disabled={!!syncingId}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-[var(--color-accent)] text-white",
                    "hover:bg-[var(--color-accent-hover)] transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync
                    </>
                  )}
                </button>
                <button
                  onClick={() => setConfirmPurge(p)}
                  disabled={!!syncingId}
                  title="Delete all & re-import from scratch"
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                    "bg-red-500/10 text-red-400 border border-red-500/20",
                    "hover:bg-red-500/20 transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Purge Dialog */}
      <Dialog
        open={!!confirmPurge}
        onClose={() => setConfirmPurge(null)}
        title="Clean Sync"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This will <span className="font-medium text-red-400">delete all existing candidates</span> from{" "}
            <span className="font-medium text-[var(--color-text-primary)]">{confirmPurge?.name}</span>{" "}
            and their downloaded resumes, then re-import everything fresh with complete data.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setConfirmPurge(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmPurge && startSync(confirmPurge, true)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "bg-red-500 text-white",
                "hover:bg-red-600 transition-colors"
              )}
            >
              Delete All & Re-sync
            </button>
          </div>
        </div>
      </Dialog>

      {/* Sync Result Dialog */}
      <Dialog open={!!result} onClose={closeResult} title="Sync Results">
        {result?.success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Sync from {resultPlatformName} complete
            </p>
            <div className="text-center space-y-1">
              {result.created > 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {result.created}
                  </span>{" "}
                  new candidate{result.created !== 1 ? "s" : ""} imported
                </p>
              )}
              {result.updated > 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-accent)]">
                    {result.updated}
                  </span>{" "}
                  candidate{result.updated !== 1 ? "s" : ""} updated
                </p>
              )}
              {result.resumesDownloaded > 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium text-purple-400">
                    {result.resumesDownloaded}
                  </span>{" "}
                  resume{result.resumesDownloaded !== 1 ? "s" : ""} downloaded
                </p>
              )}
              {result.resumesFailed > 0 && (
                <p className="text-xs text-amber-400">
                  {result.resumesFailed} resume{result.resumesFailed !== 1 ? "s" : ""} failed to download
                </p>
              )}
              {result.created === 0 && result.updated === 0 && result.resumesDownloaded === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Everything is up to date ({result.total} candidates checked)
                </p>
              )}
            </div>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Sync Failed</p>
            <p className="text-sm text-[var(--color-text-muted)]">{result.error}</p>
          </div>
        ) : null}
        <div className="flex justify-end pt-4">
          <button
            onClick={closeResult}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)]"
            )}
          >
            Done
          </button>
        </div>
      </Dialog>
    </div>
  );
}
