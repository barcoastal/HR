"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Row = {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
};

export function AuditLogTable({
  rows,
  actions,
  currentFilters,
}: {
  rows: Row[];
  actions: string[];
  currentFilters: { action?: string; entityType?: string; actorEmail?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/audit-log?${params.toString()}`);
  }

  function fmt(d: string) {
    return new Date(d).toLocaleString();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={currentFilters.action ?? ""}
          onChange={(e) => setFilter("action", e.target.value)}
          className="px-3 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)]"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          defaultValue={currentFilters.actorEmail ?? ""}
          onBlur={(e) => setFilter("actorEmail", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setFilter("actorEmail", (e.target as HTMLInputElement).value)}
          placeholder="Actor email…"
          className="px-3 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)]"
        />
        <input
          defaultValue={currentFilters.entityType ?? ""}
          onBlur={(e) => setFilter("entityType", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setFilter("entityType", (e.target as HTMLInputElement).value)}
          placeholder="Entity type…"
          className="px-3 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)]"
        />
        {(currentFilters.action || currentFilters.actorEmail || currentFilters.entityType) && (
          <button
            type="button"
            onClick={() => router.push("/audit-log")}
            className="px-3 py-2 rounded-lg text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-background)]"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-on-surface-variant)]">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-on-surface-variant)]">
          No audit entries match the current filters.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-background)] text-left text-xs uppercase tracking-wide text-[var(--color-on-surface-variant)]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)] align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--color-on-surface-variant)]">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.actorEmail ?? "—"}</div>
                    <div className="text-xs text-[var(--color-on-surface-variant)]">{r.actorRole ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.entityType ? (
                      <>
                        <div>{r.entityType}</div>
                        <div className="text-[var(--color-on-surface-variant)] break-all">{r.entityId}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.details ? (
                      <pre className="whitespace-pre-wrap break-words max-w-md text-[var(--color-on-surface-variant)]">
                        {JSON.stringify(r.details, null, 2)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
