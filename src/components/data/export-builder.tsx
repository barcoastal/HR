"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { previewExportCount, type ExportOption, type ExportOptions } from "@/lib/actions/exports";
import {
  EXPORT_BY_KEY,
  EXPORT_ENTITIES,
  defaultColumnKeys,
  type ExportEntityKey,
  type ExportFilter,
  type ExportFormat,
} from "@/lib/import-export/export-registry";

const FIELD_CLASS =
  "w-full px-2.5 py-1.5 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40";
const LINK_CLASS = "text-xs font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50 disabled:no-underline";

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "csv", label: "CSV", hint: ".csv" },
  { value: "xlsx", label: "Excel", hint: ".xlsx" },
];

export function ExportBuilder({ options }: { options: ExportOptions }) {
  const [entity, setEntity] = useState<ExportEntityKey>("people");
  const def = EXPORT_BY_KEY[entity];
  const [selected, setSelected] = useState<string[]>(() => defaultColumnKeys(def));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [count, setCount] = useState<number | null>(null);
  const [countFailed, setCountFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  // Live "N rows match": re-count when the entity or a filter changes. Debounced
  // because date inputs fire per keystroke; a request id guards stale responses.
  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const n = await previewExportCount(entity, filters);
          if (id !== requestId.current) return;
          setCount(n);
          setCountFailed(false);
        } catch {
          if (id === requestId.current) setCountFailed(true);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [entity, filters, startTransition]);

  function pickEntity(key: ExportEntityKey) {
    if (key === entity) return;
    setEntity(key);
    setSelected(defaultColumnKeys(EXPORT_BY_KEY[key]));
    setFilters({});
    setCount(null);
    setCountFailed(false);
  }

  function toggleColumn(key: string, on: boolean) {
    setSelected((prev) => (on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)));
  }

  function setFilter(param: string, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[param] = value;
      else delete next[param];
      return next;
    });
  }

  // Columns are emitted in registry order regardless of tick order.
  const orderedColumns = useMemo(() => def.columns.filter((c) => selected.includes(c.key)).map((c) => c.key), [def, selected]);
  const allSelected = orderedColumns.length === def.columns.length;
  const canDownload = orderedColumns.length > 0;

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams({ entity, columns: orderedColumns.join(","), format });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return `/api/data/export?${params.toString()}`;
  }, [entity, orderedColumns, format, filters]);

  return (
    <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="What to export" className="flex flex-col gap-2">
        {EXPORT_ENTITIES.map((e) => {
          const active = e.key === entity;
          return (
            <button
              key={e.key}
              type="button"
              aria-pressed={active}
              onClick={() => pickEntity(e.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-surface)] ring-1 ring-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]",
                )}
              >
                <Icon name={e.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">{e.label}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">{e.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section aria-label={`Export ${def.label}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] p-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Columns{" "}
              <span className="font-normal text-[var(--color-text-muted)]">
                {orderedColumns.length} of {def.columns.length}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <button type="button" className={LINK_CLASS} disabled={allSelected} onClick={() => setSelected(def.columns.map((c) => c.key))}>
                Select all
              </button>
              <button type="button" className={LINK_CLASS} onClick={() => setSelected(defaultColumnKeys(def))}>
                Defaults
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-3">
            {def.columns.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={selected.includes(c.key)}
                  onChange={(e) => toggleColumn(c.key, e.target.checked)}
                  className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-b border-[var(--color-border)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Filters</h2>
          {def.filters.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No filters — every record is included.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {def.filters.map((f) => (
                <FilterField key={f.key} filter={f} values={filters} options={options} onChange={setFilter} />
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-[var(--color-border)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Format</h2>
          <div
            role="radiogroup"
            aria-label="File format"
            className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container)] p-0.5"
          >
            {FORMATS.map((f) => {
              const active = f.value === format;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  {f.label}
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            {isPending && <Icon name="progress_activity" size={16} className="animate-material-spin text-[var(--color-accent)]" />}
            {countFailed
              ? "Couldn't count matching rows."
              : count === null
                ? "Counting…"
                : `${count.toLocaleString()} ${count === 1 ? "row matches" : "rows match"}`}
          </p>
          <a
            href={canDownload ? downloadUrl : undefined}
            download
            aria-disabled={!canDownload}
            tabIndex={canDownload ? undefined : -1}
            onClick={(e) => {
              if (!canDownload) e.preventDefault();
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]",
              !canDownload && "pointer-events-none opacity-50",
            )}
          >
            <Icon name="download" size={16} />
            Download {format === "csv" ? "CSV" : "Excel"}
          </a>
        </footer>
      </section>
    </div>
  );
}

function FilterField({
  filter,
  values,
  options,
  onChange,
}: {
  filter: ExportFilter;
  values: Record<string, string>;
  options: ExportOptions;
  onChange: (param: string, value: string) => void;
}) {
  if (filter.type === "dateRange") {
    const fromKey = `${filter.key}From`;
    const toKey = `${filter.key}To`;
    return (
      <fieldset className="min-w-0">
        <legend className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">{filter.label}</legend>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            From
            <input type="date" value={values[fromKey] ?? ""} max={values[toKey] || undefined} onChange={(e) => onChange(fromKey, e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            To
            <input type="date" value={values[toKey] ?? ""} min={values[fromKey] || undefined} onChange={(e) => onChange(toKey, e.target.value)} className={FIELD_CLASS} />
          </label>
        </div>
      </fieldset>
    );
  }

  const choices: ExportOption[] = filter.options ?? (filter.optionsFrom ? options[filter.optionsFrom] : []);
  return (
    <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
      {filter.label}
      <select value={values[filter.key] ?? ""} onChange={(e) => onChange(filter.key, e.target.value)} className={FIELD_CLASS}>
        <option value="">Any</option>
        {choices.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
