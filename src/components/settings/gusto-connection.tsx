"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { EmployeeMapping } from "@/components/gusto/employee-mapping";
import { disconnectGusto } from "@/lib/actions/gusto";
import type { GustoEmployee } from "@/lib/gusto";

type CalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gustoEmployeeId: string | null;
};

type Props = {
  connection: {
    companyName: string;
    createdAt: Date;
    tokenExpiresAt: Date;
  } | null;
  mapping?: {
    gustoEmps: GustoEmployee[];
    mapped: CalEmployee[];
    unmappedGusto: GustoEmployee[];
    unmappedCal: CalEmployee[];
  } | null;
};

export function GustoConnection({ connection, mapping }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stale = connection ? connection.tokenExpiresAt.getTime() === 0 : false;

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGusto();
      setShowConfirm(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="payments" size={20} />
          Gusto Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <GustoConnectionStatus
          connected={!!connection}
          companyName={connection?.companyName}
          connectedAt={connection?.createdAt}
          stale={stale}
        />

        {!connection && (
          <a href="/api/platforms/gusto/authorize">
            <Button>
              <Icon name="link" size={16} className="mr-2" />
              Connect Gusto
            </Button>
          </a>
        )}

        {connection && !stale && (
          <>
            {!showConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
                Disconnect
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm flex-1">This will remove all employee mappings. Are you sure?</p>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isPending}>
                  {isPending ? "Disconnecting..." : "Yes, disconnect"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {mapping && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Employee Mapping</h3>
                <EmployeeMapping
                  gustoEmployees={mapping.gustoEmps}
                  mappedEmployees={mapping.mapped}
                  unmappedGusto={mapping.unmappedGusto}
                  unmappedCal={mapping.unmappedCal}
                />
              </div>
            )}
          </>
        )}

        {connection && stale && (
          <a href="/api/platforms/gusto/authorize">
            <Button>
              <Icon name="refresh" size={16} className="mr-2" />
              Reconnect Gusto
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
