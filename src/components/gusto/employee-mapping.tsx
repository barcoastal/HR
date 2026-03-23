"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mapEmployeeToGusto, unmapEmployee } from "@/lib/actions/gusto";
import type { GustoEmployee } from "@/lib/gusto";

type CalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gustoEmployeeId: string | null;
};

type Props = {
  gustoEmployees: GustoEmployee[];
  mappedEmployees: CalEmployee[];
  unmappedGusto: GustoEmployee[];
  unmappedCal: CalEmployee[];
};

export function EmployeeMapping({ gustoEmployees, mappedEmployees, unmappedGusto, unmappedCal }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleMap(employeeId: string, gustoId: string) {
    startTransition(async () => {
      await mapEmployeeToGusto(employeeId, gustoId);
    });
  }

  function handleUnmap(employeeId: string) {
    startTransition(async () => {
      await unmapEmployee(employeeId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-sm">
        <span className="text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text-primary)]">{mappedEmployees.length}</span> mapped
        </span>
        <span className="text-[var(--color-text-muted)]">
          <span className="font-semibold text-amber-500">{unmappedGusto.length}</span> unmatched in Gusto
        </span>
      </div>

      {mappedEmployees.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Mapped Employees</h4>
          <div className="space-y-1">
            {mappedEmployees.map((emp) => {
              const ge = gustoEmployees.find((g) => g.uuid === emp.gustoEmployeeId);
              return (
                <div key={emp.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)]">
                  <div className="flex items-center gap-2">
                    <Icon name="link" size={16} className="text-emerald-500" />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    <Icon name="arrow_forward" size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">{ge?.first_name} {ge?.last_name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleUnmap(emp.id)} disabled={isPending}>
                    <Icon name="link_off" size={16} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unmappedGusto.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Unmatched Gusto Employees</h4>
          <div className="space-y-2">
            {unmappedGusto.map((ge) => (
              <UnmatchedRow
                key={ge.uuid}
                gustoEmployee={ge}
                availableEmployees={unmappedCal}
                onMap={handleMap}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {unmappedGusto.length === 0 && mappedEmployees.length > 0 && (
        <p className="text-sm text-emerald-600">All Gusto employees are mapped.</p>
      )}
    </div>
  );
}

function UnmatchedRow({
  gustoEmployee,
  availableEmployees,
  onMap,
  isPending,
}: {
  gustoEmployee: GustoEmployee;
  availableEmployees: CalEmployee[];
  onMap: (employeeId: string, gustoId: string) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState("");

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-[var(--color-surface-container)]">
      <Badge variant="warning">{gustoEmployee.first_name} {gustoEmployee.last_name}</Badge>
      <span className="text-xs text-[var(--color-text-muted)]">{gustoEmployee.email}</span>
      <div className="flex-1" />
      <select
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Select employee...</option>
        {availableEmployees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.firstName} {e.lastName} ({e.email})
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        size="sm"
        disabled={!selected || isPending}
        onClick={() => onMap(selected, gustoEmployee.uuid)}
      >
        Link
      </Button>
    </div>
  );
}
