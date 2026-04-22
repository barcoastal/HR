"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { reactivateEmployee } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function ReactivateEmployeeButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [working, setWorking] = useState(false);
  const router = useRouter();

  async function handleReactivate() {
    if (
      !confirm(
        `Bring ${employeeName} back to the organization? They'll be marked ACTIVE and their login will be re-enabled if they had one.`
      )
    )
      return;
    setWorking(true);
    try {
      await reactivateEmployee(employeeId);
      router.refresh();
    } catch (e) {
      alert(
        "Failed to reactivate: " + (e instanceof Error ? e.message : "Unknown error")
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      onClick={handleReactivate}
      disabled={working}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium",
        "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
        "hover:bg-emerald-500/20 transition-colors",
        "disabled:opacity-50"
      )}
    >
      {working ? (
        <>
          <Icon name="progress_activity" size={16} className="animate-material-spin" />{" "}
          Reactivating...
        </>
      ) : (
        <>
          <Icon name="restart_alt" size={16} /> Reactivate
        </>
      )}
    </button>
  );
}
