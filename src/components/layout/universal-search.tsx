"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type SearchResultKind = "employee" | "document" | "candidate" | "position" | "update";

type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  detail?: string;
  status?: string;
  href: string;
  newTab?: boolean;
};

const GROUPS: { kind: SearchResultKind; label: string; icon: string }[] = [
  { kind: "employee", label: "Employees", icon: "person" },
  { kind: "document", label: "Documents", icon: "description" },
  { kind: "candidate", label: "Candidates", icon: "person_search" },
  { kind: "position", label: "Positions", icon: "work" },
  { kind: "update", label: "Updates", icon: "dynamic_feed" },
];

const ICONS: Record<SearchResultKind, string> = Object.fromEntries(
  GROUPS.map((group) => [group.kind, group.icon])
) as Record<SearchResultKind, string>;

export function UniversalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const groupedResults = useMemo(
    () => GROUPS.map((group) => ({ ...group, results: results.filter((result) => result.kind === group.kind) })).filter((group) => group.results.length > 0),
    [results]
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    setActiveIndex(0);
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/global-search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results || []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setResults([]);
          setError("Search is temporarily unavailable. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function closeSearch() {
    setOpen(false);
  }

  function openResult(result: SearchResult) {
    closeSearch();
    if (result.newTab) {
      window.open(result.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(result.href);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openResult(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-10 w-full max-w-xl items-center gap-3 rounded-xl px-3 sm:flex",
          "bg-[var(--color-surface-container-lowest)] text-left text-sm text-[var(--color-text-secondary)]",
          "outline outline-1 outline-[var(--color-outline-variant)]/45 transition-colors duration-150",
          "hover:bg-white focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        )}
        aria-label="Search the HRIS"
      >
        <Icon name="search" size={19} className="shrink-0 text-[var(--color-text-secondary)]" />
        <span className="min-w-0 flex-1 truncate">Search people, documents, emails, and more</span>
        <kbd className="hidden rounded-md bg-[var(--color-surface-container)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] sm:hidden"
        aria-label="Search the HRIS"
      >
        <Icon name="search" size={21} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/35 px-3 pt-[8vh] sm:px-6 sm:pt-[12vh]"
          role="presentation"
          onMouseDown={closeSearch}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Universal search"
            className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--color-surface-container-lowest)] shadow-[0_8px_32px_rgba(26,26,39,0.16)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-outline-variant)]/35 px-4 py-3">
              <Icon name="search" size={22} className="shrink-0 text-[var(--color-primary)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, phone, email, document, or status"
                className="h-10 min-w-0 flex-1 bg-transparent text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]"
                aria-label="Search query"
                aria-controls="global-search-results"
                aria-activedescendant={results[activeIndex]?.id}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                  aria-label="Clear search"
                >
                  <Icon name="close" size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={closeSearch}
                className="hidden rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] sm:block"
              >
                Esc
              </button>
            </div>

            <div id="global-search-results" className="max-h-[62vh] min-h-48 overflow-y-auto p-2" role="listbox">
              {query.trim().length < 2 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                  <Icon name="manage_search" size={34} className="mb-3 text-[var(--color-text-secondary)]" />
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Search the entire HRIS</p>
                  <p className="mt-1 max-w-md text-sm text-[var(--color-text-secondary)]">
                    Find employees, phone numbers, emails, documents, candidates, positions, and company updates.
                  </p>
                </div>
              ) : loading ? (
                <div className="space-y-2 p-2" aria-label="Searching">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl px-3 py-3">
                      <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--color-surface-container)] motion-reduce:animate-none" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--color-surface-container)] motion-reduce:animate-none" />
                        <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--color-surface-container)] motion-reduce:animate-none" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                  <Icon name="error" size={30} className="mb-3 text-red-600" />
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{error}</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
                  <Icon name="search_off" size={32} className="mb-3 text-[var(--color-text-secondary)]" />
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">No results for “{query.trim()}”</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Try a name, email, phone number, document title, or status.</p>
                </div>
              ) : (
                groupedResults.map((group) => (
                  <div key={group.kind} className="pb-2">
                    <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                      <Icon name={group.icon} size={15} />
                      {group.label}
                    </div>
                    {group.results.map((result) => {
                      const resultIndex = results.findIndex((item) => item.id === result.id);
                      const active = resultIndex === activeIndex;
                      return (
                        <a
                          key={result.id}
                          id={result.id}
                          href={result.href}
                          target={result.newTab ? "_blank" : undefined}
                          rel={result.newTab ? "noopener noreferrer" : undefined}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(resultIndex)}
                          onClick={closeSearch}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors duration-150",
                            active ? "bg-[var(--color-primary-fixed)]" : "hover:bg-[var(--color-surface-hover)]"
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-container)] text-[var(--color-primary)]">
                            <Icon name={ICONS[result.kind]} size={19} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{result.title}</p>
                              {result.status && (
                                <span className="shrink-0 rounded-full bg-[var(--color-surface-container)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                                  {result.status}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-[var(--color-text-secondary)]">
                              {result.subtitle}{result.detail ? ` · ${result.detail}` : ""}
                            </p>
                          </div>
                          <Icon name={result.newTab ? "open_in_new" : "arrow_forward"} size={16} className="shrink-0 text-[var(--color-text-secondary)]" />
                        </a>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="hidden items-center gap-4 border-t border-[var(--color-outline-variant)]/35 px-4 py-2 text-[11px] text-[var(--color-text-secondary)] sm:flex">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
