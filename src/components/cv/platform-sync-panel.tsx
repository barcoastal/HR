"use client";

import { cn, timeAgo } from "@/lib/utils";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { forceResyncPlatform } from "@/lib/actions/platform-sync";
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
  candidatesFound: number;
  candidatesCreated: number;
  candidatesUpdated: number;
  skippedEmails: string[];
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
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultPlatformName, setResultPlatformName] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const router = useRouter();

  const connected = platforms.filter((p) => p.isConnected);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  if (connected.length === 0) return null;

  function handleSync(platform: SyncablePlatform) {
    setSyncingId(platform.id);
    setProgress(null);
    setResultPlatformName(platform.name);

    const es = new EventSource(
      `/api/platforms/sync-stream?platformId=${encodeURIComponent(platform.id)}`
    );
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
          candidatesFound: data.fetched,
          candidatesCreated: data.created,
          candidatesUpdated: data.updated || 0,
          skippedEmails: Array(data.skipped).fill(""),
          error: undefined,
        });
        router.refresh();
      } else if (data.type === "error") {
        es.close();
        eventSourceRef.current = null;
        setSyncingId(null);
        setResult({
          success: false,
          candidatesFound: data.fetched,
          candidatesCreated: data.created,
          candidatesUpdated: data.updated || 0,
          skippedEmails: [],
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
        candidatesFound: 0,
        candidatesCreated: 0,
        candidatesUpdated: 0,
        skippedEmails: [],
        error: "Connection lost during sync",
      });
    };
  }

  async function handleForceResync(platform: SyncablePlatform) {
    setResyncingId(platform.id);
    setResultPlatformName(platform.name);
    const res = await forceResyncPlatform(platform.id);
    setResyncingId(null);
    setResult({
      success: res.success,
      candidatesFound: 0,
      candidatesCreated: 0,
      candidatesUpdated: res.updated,
      skippedEmails: [],
      error: res.error,
    });
    router.refresh();
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
                    Page {progress.page}
                    {progress.total > 0 ? ` — ${progress.fetched}/${progress.total}` : ""}
                    {" | "}
                    {progress.created} new, {(progress as SyncProgressEvent & { updated?: number }).updated || 0} updated, {progress.skipped} skipped
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleSync(p)}
                  disabled={isSyncing || !!syncingId || !!resyncingId}
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
                      Sync New
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleForceResync(p)}
                  disabled={isSyncing || !!syncingId || !!resyncingId}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                    "hover:bg-amber-500/20 transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  {resyncingId === p.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Re-syncing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Re-sync All
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Result Dialog */}
      <Dialog open={!!result} onClose={closeResult} title="Sync Results">
        {result?.success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Sync from {resultPlatformName} complete
            </p>
            <div className="text-center space-y-1">
              <p className="text-sm text-[var(--color-text-muted)]">
                <span className="font-medium text-[var(--color-text-primary)]">
                  {result.candidatesCreated}
                </span>{" "}
                new candidate{result.candidatesCreated !== 1 ? "s" : ""} imported
              </p>
              {result.candidatesUpdated > 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-accent)]">
                    {result.candidatesUpdated}
                  </span>{" "}
                  existing candidate{result.candidatesUpdated !== 1 ? "s" : ""} updated with new data
                </p>
              )}
              {result.skippedEmails.length > 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {result.skippedEmails.length} duplicate{result.skippedEmails.length !== 1 ? "s" : ""} skipped
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
