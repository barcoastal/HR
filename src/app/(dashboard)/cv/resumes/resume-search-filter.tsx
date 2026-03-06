"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

type Props = {
  sources: string[];
};

export function ResumeSearchFilter({ sources }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/cv/resumes?${params.toString()}`);
    },
    [router, searchParams]
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilters("search", search);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <form onSubmit={handleSearchSubmit} className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full pl-9 pr-3 py-2 rounded-lg text-sm",
            "bg-[var(--color-surface)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          )}
        />
      </form>
      <select
        value={searchParams.get("source") || ""}
        onChange={(e) => updateFilters("source", e.target.value)}
        className={cn(
          "px-3 py-2 rounded-lg text-sm",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        )}
      >
        <option value="">All Sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={searchParams.get("from") || ""}
        onChange={(e) => updateFilters("from", e.target.value)}
        className={cn(
          "px-3 py-2 rounded-lg text-sm",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        )}
        placeholder="From"
      />
      <input
        type="date"
        value={searchParams.get("to") || ""}
        onChange={(e) => updateFilters("to", e.target.value)}
        className={cn(
          "px-3 py-2 rounded-lg text-sm",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        )}
        placeholder="To"
      />
    </div>
  );
}
