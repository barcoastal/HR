"use client";

import { useState } from "react";
import { cleanupDemoData } from "@/lib/actions/cleanup";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export function CleanupDemoButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ deletedEmployees: string[]; deletedDepartments: string[] } | null>(null);

  async function handleCleanup() {
    if (!confirm("This will permanently delete all demo/seed employees and empty departments. Continue?")) return;
    setRunning(true);
    try {
      const res = await cleanupDemoData();
      setResult(res);
    } catch (e) {
      alert("Cleanup failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Cleanup Demo Data</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Remove all demo/seed employees (non @coastaldebt.com) and empty departments.
      </p>
      {result ? (
        <div className="text-xs space-y-1">
          <p className="text-emerald-400 font-medium">
            Deleted {result.deletedEmployees.length} employees, {result.deletedDepartments.length} departments
          </p>
          {result.deletedEmployees.length > 0 && (
            <ul className="text-[var(--color-text-muted)] max-h-32 overflow-y-auto">
              {result.deletedEmployees.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={handleCleanup}
          disabled={running}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
            "bg-red-500/10 text-red-400 hover:bg-red-500/20",
            "disabled:opacity-50 transition-colors"
          )}
        >
          {running ? (
            <><Icon name="progress_activity" size={12} className="animate-material-spin" /> Cleaning up...</>
          ) : (
            <><Icon name="delete" size={12} /> Remove Demo Employees</>
          )}
        </button>
      )}
    </div>
  );
}
