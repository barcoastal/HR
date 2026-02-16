"use client";

import { cn } from "@/lib/utils";
import { Briefcase, Plus, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { createJobTitle, deleteJobTitle } from "@/lib/actions/job-titles";
import { useRouter } from "next/navigation";

type JobTitle = { id: string; name: string };
type Props = { jobTitles: JobTitle[] };

export function JobTitleManager({ jobTitles }: Props) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    await createJobTitle(trimmed);
    setAdding(false);
    setName("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteJobTitle(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <section
      className={cn(
        "rounded-xl p-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center gap-2 mb-5">
        <Briefcase className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Job Titles
        </h2>
      </div>

      {/* Tags / chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {jobTitles.map((jt) => (
          <span
            key={jt.id}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
              "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            )}
          >
            {jt.name}
            <button
              onClick={() => handleDelete(jt.id)}
              disabled={deletingId === jt.id}
              className="p-0.5 rounded-full hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {deletingId === jt.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </span>
        ))}
        {jobTitles.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            No job titles defined yet.
          </p>
        )}
      </div>

      {/* Add new job title */}
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New job title"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm",
            "bg-[var(--color-background)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          )}
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || adding}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50"
          )}
        >
          {adding ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Add
            </>
          )}
        </button>
      </div>
    </section>
  );
}
