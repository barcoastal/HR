"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { syncCandidatesFromPlatform } from "@/lib/actions/platform-sync";

type SyncablePlatform = {
  id: string;
  name: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  totalSynced: number;
};

export function IndeedImport({ platform }: { platform?: SyncablePlatform | null }) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    candidatesFound?: number;
    candidatesCreated?: number;
    skippedEmails?: string[];
    error?: string;
  } | null>(null);
  const router = useRouter();

  const isConnected = platform?.isConnected ?? false;

  async function handleSync() {
    if (!platform) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncCandidatesFromPlatform(platform.id);
      setResult(res);
      if (res.success) {
        router.refresh();
      }
    } catch (error: any) {
      setResult({ success: false, error: error?.message || "Sync failed" });
    }
    setSyncing(false);
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    if (result?.success) router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          "bg-[#2164f3]/10 text-[#2164f3] hover:bg-[#2164f3]/20",
          "border border-[#2164f3]/20"
        )}
      >
        <div className="w-5 h-5 rounded bg-[#2164f3] flex items-center justify-center">
          <span className="text-white text-[8px] font-bold">iD</span>
        </div>
        Import from Indeed
      </button>

      <Dialog open={open} onClose={handleClose} title="Import Candidates from Indeed">
        <div className="space-y-4">
          {!isConnected ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-[#2164f3]/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-[#2164f3] text-2xl font-bold">iD</span>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Indeed Not Connected</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Connect your Indeed account in Settings &gt; Recruitment Platforms to import candidates.
              </p>
              <a
                href="/settings"
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                )}
              >
                <Icon name="settings" size={14} />
                Go to Settings
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#2164f3]/5 border border-[#2164f3]/20">
                <div className="w-10 h-10 rounded-xl bg-[#2164f3] flex items-center justify-center">
                  <span className="text-white text-sm font-bold">iD</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Indeed</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {platform?.lastSyncAt
                      ? `Last synced: ${new Date(platform.lastSyncAt).toLocaleDateString()} · ${platform.totalSynced} candidates imported`
                      : "Never synced"}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--color-text-primary)]">What will be imported:</p>
                <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                  <li className="flex items-center gap-2">
                    <Icon name="check_circle" size={14} className="text-emerald-500" />
                    Candidate names, emails, phone numbers
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="check_circle" size={14} className="text-emerald-500" />
                    LinkedIn profiles and resume URLs
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="check_circle" size={14} className="text-emerald-500" />
                    Skills, experience, and job titles
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="check_circle" size={14} className="text-emerald-500" />
                    Application source tagged as "Indeed"
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="info" size={14} className="text-[var(--color-text-muted)]" />
                    Duplicate emails will be skipped automatically
                  </li>
                </ul>
              </div>

              {result && (
                <div className={cn(
                  "p-3 rounded-lg border text-sm",
                  result.success
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700"
                    : "bg-red-500/5 border-red-500/20 text-red-700"
                )}>
                  {result.success ? (
                    <div>
                      <p className="font-medium flex items-center gap-1.5">
                        <Icon name="check_circle" size={16} />
                        Import Complete
                      </p>
                      <p className="text-xs mt-1">
                        Found {result.candidatesFound} candidates · {result.candidatesCreated} new imported
                        {(result.skippedEmails?.length ?? 0) > 0 && ` · ${result.skippedEmails?.length} duplicates skipped`}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium flex items-center gap-1.5">
                        <Icon name="error" size={16} />
                        Import Failed
                      </p>
                      <p className="text-xs mt-1">{result.error}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                >
                  {result?.success ? "Done" : "Cancel"}
                </button>
                {!result?.success && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                      "bg-[#2164f3] text-white hover:bg-[#1a53d0]",
                      "disabled:opacity-50"
                    )}
                  >
                    {syncing ? (
                      <>
                        <Icon name="progress_activity" size={14} className="animate-material-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Icon name="download" size={14} />
                        Import Candidates
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
