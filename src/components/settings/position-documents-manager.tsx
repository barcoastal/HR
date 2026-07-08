"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePositionDocument } from "@/lib/actions/position-documents";
import { PdfDocumentEditor, type Countersigner, type EditableDoc } from "@/components/settings/stage-documents-manager";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type PositionDoc = EditableDoc & { positionId: string; order: number };

type PositionOption = { id: string; title: string; departmentName: string | null };

export function PositionDocumentsManager({
  documents,
  positions,
  countersigners,
}: {
  documents: PositionDoc[];
  positions: PositionOption[];
  countersigners: Countersigner[];
}) {
  const router = useRouter();
  const [activePositionId, setActivePositionId] = useState<string>(positions[0]?.id ?? "");
  const [editing, setEditing] = useState<PositionDoc | null>(null);
  const [creating, setCreating] = useState(false);

  const positionDocs = documents.filter((d) => d.positionId === activePositionId);
  const countByPosition = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.positionId] = (acc[d.positionId] || 0) + 1;
    return acc;
  }, {});

  function cancel() {
    setCreating(false);
    setEditing(null);
  }

  return (
    <section className="rounded-xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="work" size={20} className="text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Position Documents</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Documents tied to a specific position, e.g. compensation plans. Sent automatically at hire
              alongside the Pre-Onboarding stage documents, only to hires for that position.
            </p>
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] italic py-4 text-center">
          No positions exist yet. Create a position in Recruitment first.
        </p>
      ) : (
        <>
          {/* Position selector */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Position</label>
            <select
              value={activePositionId}
              onChange={(e) => { setActivePositionId(e.target.value); cancel(); }}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.departmentName ? ` — ${p.departmentName}` : ""}
                  {countByPosition[p.id] ? ` (${countByPosition[p.id]} doc${countByPosition[p.id] > 1 ? "s" : ""})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Document list */}
          {!creating && !editing && (
            <>
              <div className="space-y-2 mb-4">
                {positionDocs.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)] italic py-4 text-center">
                    No documents for this position yet.
                  </p>
                )}
                {positionDocs.map((doc) => {
                  const placeholderCount = JSON.parse(doc.placeholders || "[]").length;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon name="picture_as_pdf" size={18} className="text-red-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                          <p className={cn("text-xs flex items-center gap-1.5", !doc.hasPdf ? "text-amber-400" : "text-[var(--color-text-muted)]")}>
                            {!doc.hasPdf ? "No PDF — click edit to upload" : `${placeholderCount} placeholder${placeholderCount !== 1 ? "s" : ""} marked`}
                            {doc.requiresSignature && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400">
                                <Icon name="draw" size={10} />sign
                              </span>
                            )}
                            {doc.requiresFill && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-400">
                                <Icon name="edit_document" size={10} />fill
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditing(doc)}
                          className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this document?")) return;
                            await deletePositionDocument(doc.id);
                            router.refresh();
                          }}
                          className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setCreating(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
              >
                + Upload PDF Document
              </button>
            </>
          )}

          {/* Create/Edit form */}
          {(creating || editing) && (
            <PdfDocumentEditor
              positionId={activePositionId}
              existing={editing}
              countersigners={countersigners}
              onDone={() => { cancel(); router.refresh(); }}
              onCancel={cancel}
            />
          )}
        </>
      )}
    </section>
  );
}
