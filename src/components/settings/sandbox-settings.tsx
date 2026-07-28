"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSandboxMode } from "@/lib/actions/company-settings";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function SandboxSettings({
  initialEnabled,
  envForced,
}: {
  initialEnabled: boolean;
  /** True when SANDBOX_MODE env forces sandbox on regardless of this toggle */
  envForced?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (envForced) return;
    const next = !enabled;
    setSaving(true);
    try {
      await setSandboxMode(next);
      setEnabled(next);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const active = envForced || enabled;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="science" size={18} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Sandbox mode</h3>
            {active && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                On
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            Safe testing for everyone on this app. Emails, SMS, calendar invites, and Gusto writes are
            dry-run only (logged, not sent). The app UI still works normally.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={active}
          disabled={saving || envForced}
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            active ? "bg-amber-500" : "bg-[var(--color-border)]",
            (saving || envForced) && "opacity-60 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              active && "translate-x-5"
            )}
          />
        </button>
      </div>

      {envForced && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2">
          Forced on by <code className="font-mono">SANDBOX_MODE</code> env var. Remove or set it to{" "}
          <code className="font-mono">false</code> to control this from Settings.
        </p>
      )}

      {active && !envForced && (
        <p className="text-xs text-[var(--color-text-muted)]">
          All users will see a sandbox banner. Turn this off before sending real offers or emails.
        </p>
      )}
    </div>
  );
}
