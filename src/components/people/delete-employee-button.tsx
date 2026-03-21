"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { deleteEmployee } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function DeleteEmployeeButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Are you sure you want to permanently delete ${employeeName}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteEmployee(employeeId);
      router.push("/people");
    } catch (e) {
      alert("Failed to delete: " + (e instanceof Error ? e.message : "Unknown error"));
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium",
        "bg-red-500/10 text-red-400 border border-red-500/20",
        "hover:bg-red-500/20 transition-colors",
        "disabled:opacity-50"
      )}
    >
      {deleting ? (
        <><Icon name="progress_activity" size={16} className="animate-material-spin" /> Deleting...</>
      ) : (
        <><Icon name="delete" size={16} /> Delete Employee</>
      )}
    </button>
  );
}
