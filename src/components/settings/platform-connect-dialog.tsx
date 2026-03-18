"use client";

import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  connectPlatform,
  connectIndeedViaUnified,
  connectBreezyHR,
  connectBreezyHRCompany,
  disconnectPlatform,
} from "@/lib/actions/platform-sync";
import { useRouter } from "next/navigation";

const CREDENTIAL_FIELDS: Record<
  string,
  {
    label: string;
    placeholder: string;
    hint: string;
    usesUnifiedTo?: boolean;
    connectionIdHint?: string;
    usesBreezy?: boolean;
  }
> = {
  "LinkedIn Recruiter": {
    label: "Recruiter API Key",
    placeholder: "li-xxxxxxxxxxxxxxxx",
    hint: "Your LinkedIn Recruiter Seat API key (starts with li-)",
  },
  Indeed: {
    label: "Unified.to Connection ID",
    placeholder: "paste your connection_id here",
    hint: "Get your Connection ID from app.unified.to after connecting Indeed",
    usesUnifiedTo: true,
    connectionIdHint:
      "Set UNIFIED_API_KEY in your environment variables. Then paste the Connection ID from your Unified.to dashboard.",
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
  "Breezy HR": {
    label: "Email",
    placeholder: "your@email.com",
    hint: "Sign in with your Breezy HR account to connect Indeed & LinkedIn candidates",
    usesBreezy: true,
  },
};

type Platform = { id: string; name: string; apiKey: string | null };

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

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
  const [breezyEmail, setBreezyEmail] = useState("");
  const [breezyPassword, setBreezyPassword] = useState("");
  const [breezyCompanies, setBreezyCompanies] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const fields = platform ? CREDENTIAL_FIELDS[platform.name] : null;
  const isBreezy = fields?.usesBreezy;

  function handleClose() {
    setApiKey("");
    setBreezyEmail("");
    setBreezyPassword("");
    setBreezyCompanies(null);
    setError("");
    setSuccess(false);
    onClose();
  }

  async function handleConnect() {
    if (!platform) return;

    setLoading(true);
    setError("");

    if (isBreezy) {
      if (!breezyEmail.trim() || !breezyPassword.trim()) {
        setError("Email and password are required");
        setLoading(false);
        return;
      }
      const result = await connectBreezyHR(
        platform.id,
        breezyEmail.trim(),
        breezyPassword.trim()
      );
      setLoading(false);
      if (result.success && result.companies) {
        // Multiple companies — let user choose
        setBreezyCompanies(result.companies);
      } else if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          router.refresh();
        }, 1200);
      } else {
        setError(result.error || "Connection failed");
      }
      return;
    }

    if (!apiKey.trim()) return;
    const isUnified = fields?.usesUnifiedTo;
    const result = isUnified
      ? await connectIndeedViaUnified(platform.id, apiKey.trim())
      : await connectPlatform(platform.id, apiKey.trim());
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

  async function handleSelectCompany(companyId: string) {
    if (!platform) return;
    setLoading(true);
    setError("");
    const result = await connectBreezyHRCompany(
      platform.id,
      companyId,
      breezyEmail.trim(),
      breezyPassword.trim()
    );
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
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Connect ${platform?.name || ""}`}
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Connected successfully!
          </p>
        </div>
      ) : breezyCompanies ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Select the company to connect:
          </p>
          <div className="space-y-2">
            {breezyCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCompany(c.id)}
                disabled={loading}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg text-sm font-medium",
                  "bg-[var(--color-background)] border border-[var(--color-border)]",
                  "hover:bg-[var(--color-surface-hover)] transition-colors",
                  "disabled:opacity-50"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
              <span className="text-xs text-[var(--color-text-muted)]">
                Connecting...
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {isBreezy && (
              <div className="rounded-lg bg-[#6f42c1]/10 border border-[#6f42c1]/20 p-3">
                <p className="text-xs font-medium text-[#6f42c1] mb-1">
                  Breezy HR Integration
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Connect your Breezy HR account to sync candidates from Indeed,
                  LinkedIn, and other job boards you&apos;ve connected in Breezy.
                </p>
              </div>
            )}
            {fields?.usesUnifiedTo && (
              <div className="rounded-lg bg-[#2164f3]/10 border border-[#2164f3]/20 p-3">
                <p className="text-xs font-medium text-[#2164f3] mb-1">
                  Powered by Unified.to
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {fields.connectionIdHint}
                </p>
              </div>
            )}

            {isBreezy ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    Breezy HR Email *
                  </label>
                  <input
                    value={breezyEmail}
                    onChange={(e) => setBreezyEmail(e.target.value)}
                    className={inputClass}
                    placeholder="your@email.com"
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    Password *
                  </label>
                  <input
                    value={breezyPassword}
                    onChange={(e) => setBreezyPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Your Breezy HR password"
                    type="password"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {fields?.hint}
                </p>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                  {fields?.label || "API Key"} *
                </label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={inputClass}
                  placeholder={fields?.placeholder || "Enter API key..."}
                  type={fields?.usesUnifiedTo ? "text" : "password"}
                />
                {fields?.hint && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {fields.hint}
                  </p>
                )}
              </div>
            )}
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
              disabled={
                loading ||
                (isBreezy
                  ? !breezyEmail.trim() || !breezyPassword.trim()
                  : !apiKey.trim())
              }
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
              ) : isBreezy ? (
                "Sign In & Connect"
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
        <span className="font-medium text-[var(--color-text-primary)]">
          {platform?.name}
        </span>
        ? The API credentials will be removed and candidate sync will stop.
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
