"use client";

import { cn, timeAgo } from "@/lib/utils";
import { Cable, Loader2, CheckCircle2, Link2, Unlink } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-sync";
import {
  connectPlatformByName,
  disconnectPlatformByName,
} from "@/lib/actions/platform-sync";
import { useRouter } from "next/navigation";

type ConnectedPlatform = {
  name: string;
  apiKey: string | null;
  lastSyncAt: Date | null;
  totalSynced: number;
};

type Props = {
  connected: ConnectedPlatform[];
};

export function NativeIntegrations({ connected }: Props) {
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const [disconnectingName, setDisconnectingName] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const connectedMap = new Map(connected.map((c) => [c.name, c]));

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  function openConnect(name: string) {
    setConnectingName(name);
    setApiKey("");
    setError("");
    setSuccess(false);
  }

  function closeConnect() {
    setConnectingName(null);
    setApiKey("");
    setError("");
    setSuccess(false);
  }

  function openDisconnect(name: string) {
    setDisconnectingName(name);
  }

  function closeDisconnect() {
    setDisconnectingName(null);
  }

  const connectingPlatform = SUPPORTED_PLATFORMS.find((p) => p.name === connectingName);

  async function handleConnect() {
    if (!connectingPlatform || !apiKey.trim()) return;
    setLoading(true);
    setError("");
    const result = await connectPlatformByName(
      connectingPlatform.name,
      connectingPlatform.type,
      connectingPlatform.monthlyCost,
      apiKey.trim()
    );
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        closeConnect();
        router.refresh();
      }, 1200);
    } else {
      setError(result.error || "Connection failed");
    }
  }

  async function handleDisconnect() {
    if (!disconnectingName) return;
    setLoading(true);
    await disconnectPlatformByName(disconnectingName);
    setLoading(false);
    closeDisconnect();
    router.refresh();
  }

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center gap-2 mb-5">
        <Cable className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Platform Integrations
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const conn = connectedMap.get(platform.name);
          const isConnected = !!conn?.apiKey;

          return (
            <div
              key={platform.name}
              className={cn(
                "rounded-lg p-4",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "hover:bg-[var(--color-surface-hover)] transition-colors"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0",
                      platform.color
                    )}
                  >
                    {platform.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {platform.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                      {platform.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                {isConnected ? (
                  <>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400">Connected</span>
                      </div>
                      {conn.lastSyncAt && (
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          Last sync: {timeAgo(conn.lastSyncAt)} · {conn.totalSynced} imported
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => openDisconnect(platform.name)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                        "border border-red-500/30 text-red-400",
                        "hover:bg-red-500/15 transition-colors"
                      )}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-xs text-[var(--color-text-muted)]">Not connected</span>
                    </div>
                    <button
                      onClick={() => openConnect(platform.name)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                        "bg-[var(--color-accent)] text-white",
                        "hover:bg-[var(--color-accent-hover)] transition-colors"
                      )}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Connect
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Dialog */}
      <Dialog
        open={!!connectingName && !success}
        onClose={closeConnect}
        title={`Connect ${connectingPlatform?.name || ""}`}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              API Key *
            </label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputClass}
              placeholder={connectingPlatform?.keyPlaceholder || "Enter API key..."}
              type="password"
            />
            {connectingPlatform?.keyHint && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {connectingPlatform.keyHint}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={closeConnect}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!apiKey.trim() || loading}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </span>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={success} onClose={closeConnect} title="Connected">
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {connectingPlatform?.name} connected successfully!
          </p>
        </div>
      </Dialog>

      {/* Disconnect Dialog */}
      <Dialog
        open={!!disconnectingName}
        onClose={closeDisconnect}
        title="Disconnect Platform"
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Are you sure you want to disconnect{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            {disconnectingName}
          </span>
          ? The API credentials will be removed and candidate sync will stop.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={closeDisconnect}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-red-600 text-white",
              "hover:bg-red-700",
              "disabled:opacity-50"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Disconnecting...
              </span>
            ) : (
              "Disconnect"
            )}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
