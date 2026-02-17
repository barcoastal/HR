"use client";

import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { connectPlatform, disconnectPlatform } from "@/lib/actions/platform-sync";
import { useRouter } from "next/navigation";

const CREDENTIAL_FIELDS: Record<string, { label: string; placeholder: string; hint: string }> = {
  "LinkedIn Recruiter": {
    label: "Recruiter API Key",
    placeholder: "li-xxxxxxxxxxxxxxxx",
    hint: "Your LinkedIn Recruiter Seat API key (starts with li-)",
  },
  Indeed: {
    label: "Indeed Publisher API Key",
    placeholder: "indeed-xxxxxxxxxxxxxxxx",
    hint: "Your Indeed Publisher API key (starts with indeed-)",
  },
  Handshake: {
    label: "Handshake OAuth Token",
    placeholder: "hs-xxxxxxxxxxxxxxxx",
    hint: "Your Handshake employer OAuth token (starts with hs-)",
  },
  EmployFL: {
    label: "EmployFL Access Key",
    placeholder: "efl-xxxxxxxxxxxxxxxx",
    hint: "Your EmployFL employer portal access key (starts with efl-)",
  },
};

type Platform = { id: string; name: string; apiKey: string | null };

export function ConnectPlatformDialog({
  platform,
  open,
  onClose,
}: {
  platform: Platform | null;
  open: boolean;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const fields = platform ? CREDENTIAL_FIELDS[platform.name] : null;

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  function handleClose() {
    setApiKey("");
    setError("");
    setSuccess(false);
    onClose();
  }

  async function handleConnect() {
    if (!platform || !apiKey.trim()) return;
    setLoading(true);
    setError("");
    const result = await connectPlatform(platform.id, apiKey.trim());
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleClose();
        router.refresh();
      }, 1200);
    } else {
      setError(result.error || "Connection failed");
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={`Connect ${platform?.name || ""}`}>
      {success ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Connected successfully!
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                {fields?.label || "API Key"} *
              </label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClass}
                placeholder={fields?.placeholder || "Enter API key..."}
                type="password"
              />
              {fields?.hint && (
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{fields.hint}</p>
              )}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={handleClose}
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
        </>
      )}
    </Dialog>
  );
}

export function DisconnectPlatformDialog({
  platform,
  open,
  onClose,
}: {
  platform: Platform | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    if (!platform) return;
    setLoading(true);
    await disconnectPlatform(platform.id);
    setLoading(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Disconnect Platform">
      <p className="text-sm text-[var(--color-text-muted)]">
        Are you sure you want to disconnect{" "}
        <span className="font-medium text-[var(--color-text-primary)]">{platform?.name}</span>?
        The API credentials will be removed and candidate sync will stop.
      </p>
      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={onClose}
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
  );
}
