"use client";

import { cn, timeAgo } from "@/lib/utils";
import { Cable, Loader2, CheckCircle2, Unlink, Shield, LogIn, AlertCircle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SUPPORTED_PLATFORMS } from "@/lib/platform-sync";
import {
  oauthConnectPlatform,
  disconnectPlatformByName,
} from "@/lib/actions/platform-sync";
import { useRouter, useSearchParams } from "next/navigation";

type ConnectedPlatform = {
  name: string;
  apiKey: string | null;
  lastSyncAt: Date | null;
  totalSynced: number;
};

type Props = {
  connected: ConnectedPlatform[];
};

type OAuthStep = "consent" | "authenticating" | "success";

export function NativeIntegrations({ connected }: Props) {
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const [disconnectingName, setDisconnectingName] = useState<string | null>(null);
  const [oauthStep, setOauthStep] = useState<OAuthStep>("consent");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL params on mount for OAuth callback notifications
  useEffect(() => {
    const oauthSuccess = searchParams.get("oauth_success");
    const oauthError = searchParams.get("oauth_error");

    if (oauthSuccess) {
      setNotification({ type: "success", message: `${oauthSuccess} connected successfully!` });
      window.history.replaceState({}, "", "/settings");
      router.refresh();
    } else if (oauthError) {
      setNotification({ type: "error", message: oauthError });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams, router]);

  const connectedMap = new Map(connected.map((c) => [c.name, c]));

  function openConnect(name: string) {
    setConnectingName(name);
    setOauthStep("consent");
  }

  function closeConnect() {
    setConnectingName(null);
    setOauthStep("consent");
  }

  function openDisconnect(name: string) {
    setDisconnectingName(name);
  }

  function closeDisconnect() {
    setDisconnectingName(null);
  }

  const connectingPlatform = SUPPORTED_PLATFORMS.find((p) => p.name === connectingName);

  async function handleAuthorize() {
    if (!connectingPlatform) return;

    // Real OAuth: full page redirect to provider
    if (connectingPlatform.hasRealOAuth) {
      closeConnect();
      window.location.href = `/api/platforms/${connectingPlatform.oauthProviderId}/authorize`;
      return;
    }

    // Simulated flow for platforms without real OAuth
    setOauthStep("authenticating");

    const result = await oauthConnectPlatform(
      connectingPlatform.name,
      connectingPlatform.type,
      connectingPlatform.monthlyCost,
      connectingPlatform.keyPrefix
    );

    if (result.success) {
      setOauthStep("success");
      setTimeout(() => {
        closeConnect();
        router.refresh();
      }, 1500);
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
      <div className="flex items-center gap-2 mb-2">
        <Cable className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Platform Integrations
        </h2>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">
        Connect your recruitment accounts to sync candidates automatically
      </p>

      {/* OAuth callback notification banner */}
      {notification && (
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-lg mb-5 text-sm",
            notification.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="shrink-0 hover:opacity-70 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const conn = connectedMap.get(platform.name);
          const isConnected = !!conn?.apiKey;

          return (
            <div
              key={platform.name}
              className={cn(
                "rounded-xl p-5 relative overflow-hidden",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "transition-all",
                isConnected && "border-emerald-500/30"
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0",
                    platform.color
                  )}
                >
                  {platform.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {platform.name}
                    </p>
                    {isConnected && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-500">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {platform.description}
                  </p>
                </div>
              </div>

              {isConnected ? (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    {conn.lastSyncAt ? (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Last sync {timeAgo(conn.lastSyncAt)} · {conn.totalSynced} imported
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Ready to sync candidates
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openDisconnect(platform.name)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                      "text-[var(--color-text-muted)]",
                      "hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    )}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openConnect(platform.name)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                    "text-white transition-colors",
                    platform.color,
                    "hover:opacity-90"
                  )}
                >
                  <LogIn className="h-4 w-4" />
                  Sign in with {platform.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* OAuth Consent Dialog */}
      <Dialog
        open={!!connectingName && oauthStep === "consent"}
        onClose={closeConnect}
        title=""
      >
        {connectingPlatform && (
          <div className="space-y-5">
            {/* Platform header */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <div
                className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold",
                  connectingPlatform.color
                )}
              >
                {connectingPlatform.name.charAt(0)}
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  Sign in to {connectingPlatform.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {connectingPlatform.hasRealOAuth
                    ? `You'll be redirected to ${connectingPlatform.name} to sign in`
                    : "CoastalHR wants to connect to your account"}
                </p>
              </div>
            </div>

            {/* Permissions */}
            <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                This will allow CoastalHR to:
              </p>
              {connectingPlatform.permissions.map((perm) => (
                <div key={perm} className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
                  <span className="text-xs text-[var(--color-text-muted)]">{perm}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAuthorize}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                  "text-white transition-colors",
                  connectingPlatform.color,
                  "hover:opacity-90"
                )}
              >
                <LogIn className="h-4 w-4" />
                Authorize & Connect
              </button>
              <button
                onClick={closeConnect}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-center text-[var(--color-text-muted)]">
              You can disconnect at any time from Settings
            </p>
          </div>
        )}
      </Dialog>

      {/* Authenticating Dialog (only for simulated flow) */}
      <Dialog
        open={!!connectingName && oauthStep === "authenticating"}
        onClose={() => {}}
        title=""
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-10 w-10 text-[var(--color-accent)] animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Connecting to {connectingPlatform?.name}...
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Authenticating your account
            </p>
          </div>
        </div>
      </Dialog>

      {/* Success Dialog (only for simulated flow) */}
      <Dialog
        open={!!connectingName && oauthStep === "success"}
        onClose={closeConnect}
        title=""
      >
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold",
                connectingPlatform?.color
              )}
            >
              {connectingPlatform?.name.charAt(0)}
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-500 absolute -bottom-1 -right-1 bg-[var(--color-surface)] rounded-full" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {connectingPlatform?.name} connected!
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              You can now sync candidates from this platform
            </p>
          </div>
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
          ? Your credentials will be removed and candidate sync will stop.
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
