"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  connected: boolean;
  companyName?: string | null;
  connectedAt?: Date | null;
  stale?: boolean;
};

export function GustoConnectionStatus({ connected, companyName, connectedAt, stale }: Props) {
  if (!connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Icon name="link_off" size={20} className="text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Gusto is not connected</p>
          <p className="text-xs text-[var(--color-text-muted)]">Connect in Settings to enable payroll and time-off sync.</p>
        </div>
        <Link href="/settings">
          <Button variant="secondary" size="sm">Connect</Button>
        </Link>
      </div>
    );
  }

  if (stale) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
        <Icon name="error" size={20} className="text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Gusto connection lost</p>
          <p className="text-xs text-[var(--color-text-muted)]">Please reconnect in Settings to restore access.</p>
        </div>
        <Link href="/settings">
          <Button variant="secondary" size="sm">Reconnect</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <Icon name="check_circle" size={20} className="text-emerald-500" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Connected to {companyName}
        </p>
        {connectedAt && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Since {new Date(connectedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
