"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createStageDocument,
  updateStageDocument,
  deleteStageDocument,
} from "@/lib/actions/stage-documents";
import { AVAILABLE_PLACEHOLDERS } from "@/lib/stage-document-utils";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type StageDoc = {
  id: string;
  stage: string;
  name: string;
  content: string;
  order: number;
};

const STAGES = [
  { value: "PRE_ONBOARDING", label: "Pre-Onboarding", color: "text-teal-400", bg: "bg-teal-500/10" },
  { value: "ONBOARDING", label: "Onboarding", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { value: "OFFBOARDING", label: "Offboarding", color: "text-slate-400", bg: "bg-slate-500/10" },
];

export function StageDocumentsManager({ documents }: { documents: StageDoc[] }) {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState("PRE_ONBOARDING");
  const [editing, setEditing] = useState<StageDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const stageDocs = documents.filter((d) => d.stage === activeStage);

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setName("");
    setContent("");
    setPreview(false);
  }

  function startEdit(doc: StageDoc) {
    setEditing(doc);
    setCreating(false);
    setName(doc.name);
    setContent(doc.content);
    setPreview(false);
  }

  function cancel() {
    setCreating(false);
    setEditing(null);
    setName("");
    setContent("");
    setPreview(false);
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateStageDocument(editing.id, { name: name.trim(), content: content.trim() });
      } else {
        await createStageDocument({ stage: activeStage, name: name.trim(), content: content.trim() });
      }
      cancel();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document template?")) return;
    await deleteStageDocument(id);
    router.refresh();
  }

  function insertPlaceholder(placeholder: string) {
    setContent((prev) => prev + placeholder);
  }

  const previewContent = content
    .replace(/\{\{firstName\}\}/g, "John")
    .replace(/\{\{lastName\}\}/g, "Smith")
    .replace(/\{\{fullName\}\}/g, "John Smith")
    .replace(/\{\{email\}\}/g, "john.smith@email.com")
    .replace(/\{\{phone\}\}/g, "(555) 123-4567")
    .replace(/\{\{hourlyRate\}\}/g, "$25.00/hr")
    .replace(/\{\{position\}\}/g, "Software Engineer")
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))
    .replace(/\{\{company\}\}/g, "Coastal HR");

  return (
    <section className="rounded-xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="description" size={20} className="text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Stage Documents</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Documents auto-sent when a candidate moves to a stage. Use placeholders for dynamic content.
            </p>
          </div>
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 mb-5">
        {STAGES.map((s) => {
          const count = documents.filter((d) => d.stage === s.value).length;
          return (
            <button
              key={s.value}
              onClick={() => { setActiveStage(s.value); cancel(); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeStage === s.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s.label} {count > 0 && <span className="ml-1 text-xs opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Document list */}
      {!creating && !editing && (
        <>
          <div className="space-y-2 mb-4">
            {stageDocs.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] italic py-4 text-center">
                No documents configured for this stage yet.
              </p>
            )}
            {stageDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon name="article" size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {doc.content.replace(/<[^>]*>/g, "").slice(0, 80)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(doc)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            + Add Document
          </button>
        </>
      )}

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Document Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Employment Contract, NDA, Welcome Letter"
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Placeholder buttons */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Insert Placeholder</label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => insertPlaceholder(p.key)}
                  title={p.description}
                  className="px-2 py-1 rounded text-xs font-mono bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--color-text-primary)]">
                Content {preview ? "(Preview)" : "(HTML)"}
              </label>
              <button
                onClick={() => setPreview(!preview)}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
            {preview ? (
              <div
                className="w-full min-h-[200px] px-3 py-2 rounded-lg text-sm bg-white text-gray-900 border border-[var(--color-border)] prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`<p>Dear {{fullName}},</p>\n<p>Welcome to {{company}}! Your hourly rate is {{hourlyRate}}.</p>\n<p>Your position: {{position}}</p>\n<p>Date: {{date}}</p>`}
                rows={12}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-y"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !content.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Document" : "Add Document"}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
