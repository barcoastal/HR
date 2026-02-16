"use client";

import { cn, getInitials } from "@/lib/utils";
import { Search } from "lucide-react";
import { useState } from "react";
import { searchCandidates } from "@/lib/actions/candidates";

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string | null;
  status: string;
  position: { title: string } | null;
};

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try { return JSON.parse(skills); } catch { return skills.split(",").map((s) => s.trim()).filter(Boolean); }
}

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500"];
const statusColors: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-400",
  SCREENING: "bg-amber-500/15 text-amber-400",
  INTERVIEW: "bg-purple-500/15 text-purple-400",
  OFFER: "bg-emerald-500/15 text-emerald-400",
  HIRED: "bg-green-500/15 text-green-400",
  REJECTED: "bg-red-500/15 text-red-400",
};

export function SearchCandidates() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await searchCandidates(query.trim());
    setResults(res as any);
    setSearched(true);
    setLoading(false);
  }

  return (
    <div className={cn("rounded-xl p-5 mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Search Candidates</h3>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by skills, keywords, or name..."
            className={cn("w-full pl-10 pr-4 py-2 rounded-lg text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40")}
          />
        </div>
        <button onClick={handleSearch} disabled={loading} className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {searched && (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          <div className="space-y-2">
            {results.map((r) => {
              const initials = getInitials(r.firstName, r.lastName);
              const colorIdx = r.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColors[colorIdx])}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.firstName} {r.lastName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {parseSkills(r.skills).slice(0, 3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{s}</span>)}
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", statusColors[r.status] || "")}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
