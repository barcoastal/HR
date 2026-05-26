"use client";

import { cn, getInitials, timeAgo } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { CandidateStatus } from "@/generated/prisma/client";

type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  status: CandidateStatus;
  source: string | null;
  skills: string | null;
  resumeUrl: string | null;
  createdAt: Date;
  backgroundCheckStatus: string | null;
  position: { title: string } | null;
};

type PipelineStage = {
  enumValue: string;
  label: string;
  color: string;
  visible: boolean;
  order: number;
};

const STATUS_TINT: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-500",
  SCREENING: "bg-amber-500/10 text-amber-500",
  INTERVIEW: "bg-purple-500/10 text-purple-500",
  OFFER: "bg-emerald-500/10 text-emerald-500",
  BACKGROUND_CHECK: "bg-orange-500/10 text-orange-500",
  PRE_ONBOARDING: "bg-teal-500/10 text-teal-500",
  ONBOARDING: "bg-cyan-500/10 text-cyan-500",
  HIRED: "bg-green-500/10 text-green-500",
  OFFBOARDING: "bg-slate-500/10 text-slate-400",
  REJECTED: "bg-red-500/10 text-red-400",
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function parseSkills(skills: string | null): string[] {
  if (!skills) return [];
  try {
    const arr = JSON.parse(skills);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return skills.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function MyCandidatesView({
  candidates,
  pipelineStages,
}: {
  candidates: CandidateRow[];
  pipelineStages: PipelineStage[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const visibleStages = pipelineStages.filter((s) => s.visible).sort((a, b) => a.order - b.order);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!q) return true;
      const skills = parseSkills(c.skills).join(" ");
      return (
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.position?.title ?? "").toLowerCase().includes(q) ||
        (c.source ?? "").toLowerCase().includes(q) ||
        skills.toLowerCase().includes(q)
      );
    });
  }, [candidates, search, statusFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, CandidateRow[]> = {};
    for (const c of filtered) {
      groups[c.status] = groups[c.status] || [];
      groups[c.status].push(c);
    }
    return groups;
  }, [filtered]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: candidates.length };
    for (const c of candidates) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [candidates]);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, position, skill…"
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-lg text-sm",
              "bg-[var(--color-surface)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
            statusFilter === "ALL"
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          )}
        >
          All <span className="opacity-70">· {stageCounts.ALL || 0}</span>
        </button>
        {visibleStages.map((s) => (
          <button
            key={s.enumValue}
            onClick={() => setStatusFilter(s.enumValue)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              statusFilter === s.enumValue
                ? STATUS_TINT[s.enumValue] || "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {s.label} <span className="opacity-70">· {stageCounts[s.enumValue] || 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No candidates match.</p>
        </div>
      ) : statusFilter === "ALL" ? (
        <div className="space-y-6">
          {visibleStages
            .filter((s) => (grouped[s.enumValue] || []).length > 0)
            .map((s) => (
              <div key={s.enumValue}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-sm font-semibold", s.color || "text-[var(--color-text-primary)]")}>{s.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">· {(grouped[s.enumValue] || []).length}</span>
                </div>
                <CandidateList rows={grouped[s.enumValue] || []} />
              </div>
            ))}
        </div>
      ) : (
        <CandidateList rows={filtered} />
      )}
    </div>
  );
}

function CandidateList({ rows }: { rows: CandidateRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((c) => {
        const initials = getInitials(c.firstName, c.lastName);
        const colorIdx = c.firstName.charCodeAt(0) % avatarColors.length;
        const skillList = parseSkills(c.skills).slice(0, 4);
        return (
          <div
            key={c.id}
            className={cn(
              "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3",
              "flex items-center gap-3 hover:border-[var(--color-accent)]/40 transition-colors"
            )}
          >
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0",
                avatarColors[colorIdx]
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {c.firstName} {c.lastName}
                </p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_TINT[c.status] || "bg-gray-500/10 text-gray-500")}>
                  {c.status.replace("_", " ")}
                </span>
                {c.position && (
                  <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                    for <span className="text-[var(--color-text-primary)]">{c.position.title}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {c.email}
                {c.phone && <span className="ml-2">· {c.phone}</span>}
                {c.source && <span className="ml-2">· via {c.source}</span>}
                <span className="ml-2">· added {timeAgo(c.createdAt)}</span>
              </p>
              {skillList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {skillList.map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-background)] text-[var(--color-text-muted)]">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {c.resumeUrl && (
                <a
                  href={c.resumeUrl.startsWith("/") ? c.resumeUrl : `/api/platforms/jobing/resume?url=${encodeURIComponent(c.resumeUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                  title="Resume"
                >
                  <Icon name="description" size={14} />
                </a>
              )}
              {c.linkedinUrl && (
                <a
                  href={c.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                  title="LinkedIn"
                >
                  <Icon name="link" size={14} />
                </a>
              )}
              <a
                href={`mailto:${c.email}`}
                className="p-1.5 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                title="Email"
              >
                <Icon name="mail" size={14} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
