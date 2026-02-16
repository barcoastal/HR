"use client";

import { cn } from "@/lib/utils";
import { Plus, Trash2, Palmtree } from "lucide-react";
import { useState } from "react";
import { createTimeOffPolicy, deleteTimeOffPolicy } from "@/lib/actions/time-off";
import { useRouter } from "next/navigation";

type Policy = { id: string; name: string; daysPerYear: number; isUnlimited: boolean };

export function PtoPolicyManager({ policies: initialPolicies }: { policies: Policy[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [name, setName] = useState("");
  const [daysPerYear, setDaysPerYear] = useState(20);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    const policy = await createTimeOffPolicy({
      name: name.trim(),
      daysPerYear: isUnlimited ? 0 : daysPerYear,
      isUnlimited,
    });
    setPolicies((p) => [...p, policy]);
    setName("");
    setDaysPerYear(20);
    setIsUnlimited(false);
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteTimeOffPolicy(id);
    setPolicies((p) => p.filter((x) => x.id !== id));
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-4">
        <Palmtree className="h-5 w-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">PTO Policies</h2>
      </div>

      {policies.length > 0 && (
        <div className="space-y-2 mb-4">
          {policies.map((p) => (
            <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{p.isUnlimited ? "Unlimited" : `${p.daysPerYear} days/year`}</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Policy Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vacation" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Days Per Year</label>
            <input type="number" value={daysPerYear} onChange={(e) => setDaysPerYear(Number(e.target.value))} disabled={isUnlimited} min={0} className={cn(inputClass, isUnlimited && "opacity-50")} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" checked={isUnlimited} onChange={(e) => setIsUnlimited(e.target.checked)} className="rounded" />
          Unlimited PTO
        </label>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || adding}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50"
          )}
        >
          <Plus className="h-4 w-4" />{adding ? "Adding..." : "Add Policy"}
        </button>
      </div>
    </section>
  );
}
