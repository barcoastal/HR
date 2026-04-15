"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { advancedSearchCandidates, pullCandidateToRecruitment } from "@/lib/actions/candidates";
import { aiSearchCandidates } from "@/lib/actions/ai-match";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  skills: string | null;
  experience: string | null;
  source: string | null;
  status: string;
  inPipeline: boolean;
  doNotCall?: boolean;
  doNotCallReason?: string | null;
  resumeUrl?: string | null;
  applicationCount?: number;
  position: { title: string } | null;
  score?: number;
  reason?: string;
};

type Position = { id: string; title: string };

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

export function SearchCandidates({ positions = [] }: { positions?: Position[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [rowPosition, setRowPosition] = useState<Record<string, string>>({});
  const [previewResume, setPreviewResume] = useState<{ url: string; name: string } | null>(null);
  const [hideDnc, setHideDnc] = useState(true);
  const [aiMode, setAiMode] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const router = useRouter();

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      if (aiMode) {
        const matches = await aiSearchCandidates(query.trim());
        // AI match shape → convert to SearchResult rows, keep score/reason
        const asResults: SearchResult[] = matches.map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: null,
          skills: m.skills,
          experience: m.experience,
          source: m.source,
          resumeUrl: m.resumeUrl,
          status: "NEW",
          inPipeline: m.inPipeline,
          position: null,
          score: m.score,
          reason: m.reason,
        }));
        setResults(asResults);
      } else {
        const res = await advancedSearchCandidates({ query: query.trim() });
        setResults(res as SearchResult[]);
      }
    } catch (e) {
      console.error("[SearchCandidates] search error:", e);
      setResults([]);
    }
    setSearched(true);
    setLoading(false);
  }

  function closeResults() {
    setResults([]);
    setSearched(false);
    setQuery("");
  }

  async function handlePull(id: string) {
    const target = results.find((r) => r.id === id);
    if (target?.doNotCall) {
      const reason = target.doNotCallReason ? ` Reason: ${target.doNotCallReason}.` : "";
      if (!confirm(`${target.firstName} ${target.lastName} is marked DO NOT CALL.${reason}\n\nAre you sure you want to pull them into the pipeline?`)) {
        return;
      }
    }
    setPullingId(id);
    const positionId = rowPosition[id] || undefined;
    await pullCandidateToRecruitment(id, positionId);
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, inPipeline: true, status: "NEW" } : r))
    );
    setPullingId(null);
    router.refresh();
  }

  return (
    <div className={cn("rounded-xl mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setPanelOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <Icon name={aiMode ? "auto_awesome" : "search"} size={16} className={aiMode ? "text-purple-500" : "text-[var(--color-accent)]"} />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {aiMode ? "AI candidate search" : "Search all candidates"}
          </h3>
          {searched && results.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Icon name={panelOpen ? "expand_less" : "expand_more"} size={16} className="text-[var(--color-text-muted)]" />
      </div>

      {panelOpen && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAiMode(true)}
                className={cn(
                  "px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors",
                  aiMode ? "bg-purple-500/15 text-purple-600" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Icon name="auto_awesome" size={12} />
                AI
              </button>
              <button
                type="button"
                onClick={() => setAiMode(false)}
                className={cn(
                  "px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors",
                  !aiMode ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Icon name="search" size={12} />
                Keyword
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] flex-1">
              {aiMode
                ? "Type free text — e.g. &ldquo;closer with 5+ years in debt relief&rdquo; — AI ranks best fits."
                : "Keyword match on name, email, skills, experience, resume text, notes."}
            </p>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Icon name={aiMode ? "auto_awesome" : "search"} size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={aiMode ? "Describe the candidate you&rsquo;re looking for…" : "Search by name, email, skills, experience, resume text, notes…"}
                className={cn("w-full pl-11 pr-4 py-3 rounded-xl text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]")}
              />
            </div>
            <button onClick={handleSearch} disabled={loading} className={cn("px-4 py-3 rounded-xl text-sm font-medium", aiMode ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50 flex items-center gap-2")}>
              {loading && <Icon name="progress_activity" size={14} className="animate-material-spin" />}
              {loading ? (aiMode ? "Thinking…" : "Searching…") : (aiMode ? "Find matches" : "Search")}
            </button>
            {searched && (
              <button onClick={closeResults} className="px-3 py-3 rounded-xl text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                Close
              </button>
            )}
          </div>

      {searched && (
        <div>
          {(() => {
            const hiddenDnc = results.filter((r) => r.doNotCall).length;
            const visible = hideDnc ? results.filter((r) => !r.doNotCall) : results;
            return (
              <>
                <div className="flex items-center justify-between mb-2 text-xs">
                  <p className="text-[var(--color-text-muted)]">
                    {visible.length} result{visible.length !== 1 ? "s" : ""} across pipeline & database
                    {hideDnc && hiddenDnc > 0 && <> · {hiddenDnc} DNC hidden</>}
                  </p>
                  {hiddenDnc > 0 && (
                    <label className="flex items-center gap-1.5 text-[var(--color-text-muted)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideDnc}
                        onChange={(e) => setHideDnc(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      Hide Do Not Call
                    </label>
                  )}
                </div>
              </>
            );
          })()}
          <div className="space-y-2">
            {(hideDnc ? results.filter((r) => !r.doNotCall) : results).map((r) => {
              const initials = getInitials(r.firstName, r.lastName);
              const colorIdx = r.firstName.charCodeAt(0) % avatarColors.length;
              return (
                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                  <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", avatarColors[colorIdx])}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-medium", r.doNotCall ? "text-red-600" : "text-[var(--color-text-primary)]")}>{r.firstName} {r.lastName}</p>
                      {r.doNotCall && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white" title={r.doNotCallReason || undefined}>
                          DO NOT CALL
                        </span>
                      )}
                      {r.applicationCount && r.applicationCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-700">
                          {r.applicationCount}× applied
                        </span>
                      )}
                      {r.position && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">- {r.position.title}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">{r.email}{r.experience ? ` · ${r.experience}` : ""}</p>
                    {r.reason && (
                      <p className="text-[10px] text-purple-600 italic mt-0.5">{r.reason}</p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      {parseSkills(r.skills).slice(0, 3).map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{s}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.score !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600">
                        {r.score}%
                      </span>
                    )}
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", statusColors[r.status] || "")}>{r.status}</span>
                    {r.resumeUrl && (
                      <button
                        onClick={() => setPreviewResume({ url: r.resumeUrl!, name: `${r.firstName} ${r.lastName}` })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-background)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
                        title="Preview resume"
                      >
                        <Icon name="description" />
                        Resume
                      </button>
                    )}
                    {r.inPipeline ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                        <Icon name="check" />
                        Pipeline
                      </span>
                    ) : (
                      <>
                        {positions.length > 0 && (
                          <select
                            value={rowPosition[r.id] || ""}
                            onChange={(e) => setRowPosition((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                          >
                            <option value="">No position</option>
                            {positions.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => handlePull(r.id)}
                          disabled={pullingId === r.id}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                            "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors",
                            "disabled:opacity-50"
                          )}
                        >
                          <Icon name="open_in_new" />
                          {pullingId === r.id ? "..." : "Pull"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      )}

      {previewResume && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewResume(null)}
        >
          <div
            className="bg-[var(--color-surface)] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="description" size={16} className="text-[var(--color-accent)] shrink-0" />
                <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{previewResume.name} — Resume</span>
              </div>
              <button
                onClick={() => setPreviewResume(null)}
                className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <iframe
              src={previewResume.url.startsWith("/api/resumes/") ? previewResume.url : `/api/platforms/jobing/resume?url=${encodeURIComponent(previewResume.url)}`}
              className="flex-1 w-full"
              title={previewResume.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}
