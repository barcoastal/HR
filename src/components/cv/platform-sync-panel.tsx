"use client";

import { cn, timeAgo } from "@/lib/utils";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { syncCandidatesFromPlatform } from "@/lib/actions/platform-sync";
import { useRouter } from "next/navigation";

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
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultPlatformName, setResultPlatformName] = useState("");
  const router = useRouter();

  const connected = platforms.filter((p) => p.isConnected);
  if (connected.length === 0) return null;

  async function handleSync(platform: SyncablePlatform) {
    setSyncingId(platform.id);
    const res = await syncCandidatesFromPlatform(platform.id);
    setSyncingId(null);
    setResultPlatformName(platform.name);
    setResult(res);
    if (res.success) {
      router.refresh();
    }
  }

  function closeResult() {
    setResult(null);
    setResultPlatformName("");
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
              <button
                onClick={() => handleSync(p)}
                disabled={isSyncing || !!syncingId}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
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
                    Sync Candidates
                  </>
                )}
              </button>
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
