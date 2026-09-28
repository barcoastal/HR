"use client";

import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import {
  addEmployeeDocument,
  deleteEmployeeDocument,
  makeAllEmployeeDocumentsHrOnly,
  sendDocForSigning,
  updateEmployeeDocument,
} from "@/lib/actions/employee-documents";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/client";
import { Icon } from "@/components/ui/icon";
import { DOCUMENT_FOLDERS, groupDocumentsByFolder } from "@/lib/document-folders";

type Doc = {
  id: string;
  name: string;
  url: string;
  category: string;
  visibility: string;
  uploadedAt: string;
};

const selectClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)]"
);

/** Folder and visibility pickers shared by the upload and settings dialogs. */
function FolderAndVisibilityFields({
  category,
  visibility,
  onCategoryChange,
  onVisibilityChange,
}: {
  category: DocumentCategory;
  visibility: DocumentVisibility;
  onCategoryChange: (category: DocumentCategory) => void;
  onVisibilityChange: (visibility: DocumentVisibility) => void;
}) {
  const isMedical = category === "MEDICAL";
  const shownVisibility = isMedical ? "HR_ONLY" : visibility;

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Folder</label>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as DocumentCategory)}
          className={selectClass}
        >
          <option value="GENERAL">General</option>
          {DOCUMENT_FOLDERS.filter((folder) => folder.key !== "GENERAL").map((folder) => (
            <option key={folder.key} value={folder.key}>{folder.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Visibility</label>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isMedical}
            onClick={() => onVisibilityChange("EVERYONE")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              shownVisibility === "EVERYONE"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="visibility" size={16} />
            Visible to Employee
          </button>
          <button
            type="button"
            onClick={() => onVisibilityChange("HR_ONLY")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
              shownVisibility === "HR_ONLY"
                ? "border-red-400 bg-red-500/10 text-red-400"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="visibility_off" size={16} />
            HR Only
          </button>
        </div>
        {isMedical && (
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">Medical documents are always HR only.</p>
        )}
      </div>
    </>
  );
}

export function EmployeeDocumentsSection({
  employeeId,
  documents,
  isAdmin,
}: {
  employeeId: string;
  documents: Doc[];
  isAdmin: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("GENERAL");
  const [visibility, setVisibility] = useState<DocumentVisibility>("EVERYONE");
  const [requireSignature, setRequireSignature] = useState(false);
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [editCategory, setEditCategory] = useState<DocumentCategory>("GENERAL");
  const [editVisibility, setEditVisibility] = useState<DocumentVisibility>("EVERYONE");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [confirmingHrOnly, setConfirmingHrOnly] = useState(false);
  const [restricting, setRestricting] = useState(false);
  const [restrictError, setRestrictError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const folders = groupDocumentsByFolder(documents);
  const visibleToEmployeeCount = documents.filter((doc) => doc.visibility === "EVERYONE").length;

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    if (requireSignature && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files can be sent for signing.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await addEmployeeDocument({
        employeeId,
        name: file.name,
        url: data.url,
        category,
        visibility,
        requireSignature,
      });

      setUploadOpen(false);
      setCategory("GENERAL");
      setVisibility("EVERYONE");
      setRequireSignature(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  }

  async function handleSendForSigning(doc: Doc) {
    if (!confirm(`Send "${doc.name}" to this employee for signing?`)) return;
    setSendingDocId(doc.id);
    try {
      await sendDocForSigning(employeeId, doc.url, doc.name);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send for signing");
    }
    setSendingDocId(null);
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    await deleteEmployeeDocument(docId);
    router.refresh();
  }

  function openSettings(doc: Doc) {
    setEditingDoc(doc);
    setEditCategory(doc.category as DocumentCategory);
    setEditVisibility(doc.visibility as DocumentVisibility);
    setSettingsError(null);
  }

  async function handleSaveSettings() {
    if (!editingDoc) return;
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const result = await updateEmployeeDocument(editingDoc.id, {
        category: editCategory,
        visibility: editCategory === "MEDICAL" ? "HR_ONLY" : editVisibility,
      });
      if (!result.ok) {
        setSettingsError(result.error);
        return;
      }
      setEditingDoc(null);
      router.refresh();
    } catch {
      setSettingsError("Could not save. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleMakeAllHrOnly() {
    setRestricting(true);
    setRestrictError(null);
    try {
      const result = await makeAllEmployeeDocumentsHrOnly(employeeId);
      if (!result.ok) {
        setRestrictError(result.error);
        return;
      }
      setConfirmingHrOnly(false);
      router.refresh();
    } catch {
      setRestrictError("Could not update the documents. Please try again.");
    } finally {
      setRestricting(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const isPdf = (name: string) => name.toLowerCase().endsWith(".pdf");

  return (
    <section className={cn("rounded-2xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Icon name="description" size={16} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Documents</h2>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {visibleToEmployeeCount > 0 && !confirmingHrOnly && (
              <button
                onClick={() => { setConfirmingHrOnly(true); setRestrictError(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                  "border border-[var(--color-border)] text-[var(--color-text-primary)]",
                  "hover:bg-[var(--color-surface-hover)] transition-colors"
                )}
              >
                <Icon name="lock" size={12} />
                Make all HR only
              </button>
            )}
            <button
              onClick={() => setUploadOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)] transition-colors"
              )}
            >
              <Icon name="upload" size={12} />
              Upload
            </button>
          </div>
        )}
      </div>

      {isAdmin && confirmingHrOnly && (
        <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/5 p-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            Hide {visibleToEmployeeCount} document{visibleToEmployeeCount === 1 ? "" : "s"} from the employee and their manager?
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            HR and admins keep access. You can make a document visible again from its settings.
          </p>
          {restrictError && <p role="alert" className="mt-2 text-xs text-red-500">{restrictError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleMakeAllHrOnly}
              disabled={restricting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {restricting ? "Updating..." : "Make all HR only"}
            </button>
            <button
              onClick={() => setConfirmingHrOnly(false)}
              disabled={restricting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No documents yet.</p>
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => (
            <div key={folder.key}>
              <div className="flex items-center gap-2 px-3 pb-1">
                <Icon name="folder" size={14} className="text-[var(--color-text-muted)]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {folder.label}
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">{folder.documents.length}</span>
              </div>
              <div className="space-y-2">
                {folder.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg group",
                      "hover:bg-[var(--color-surface-hover)] transition-colors"
                    )}
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="h-9 w-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                        <Icon name="description" size={16} className="text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                          {doc.visibility === "HR_ONLY" && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium shrink-0">
                              <Icon name="lock" size={10} />
                              HR Only
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">{formatDate(doc.uploadedAt)}</p>
                      </div>
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <button
                          onClick={() => openSettings(doc)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-all"
                          title="Change folder or visibility"
                          aria-label={`Change folder or visibility of ${doc.name}`}
                        >
                          <Icon name="tune" size={12} />
                        </button>
                      )}
                      {isAdmin && isPdf(doc.name) && (
                        <button
                          onClick={() => handleSendForSigning(doc)}
                          disabled={sendingDocId === doc.id}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-emerald-500/15 hover:text-emerald-400 transition-all"
                          title="Send for signing"
                        >
                          <Icon name="edit_note" size={12} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 transition-all"
                        >
                          <Icon name="delete" size={12} />
                        </button>
                      )}
                      <Icon name="chevron_right" size={16} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editingDoc !== null} onClose={() => { if (!savingSettings) setEditingDoc(null); }} title="Document settings">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)] break-words">{editingDoc?.name}</p>
          <FolderAndVisibilityFields
            category={editCategory}
            visibility={editVisibility}
            onCategoryChange={setEditCategory}
            onVisibilityChange={setEditVisibility}
          />
          {settingsError && <p role="alert" className="text-xs text-red-500">{settingsError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditingDoc(null)}
              disabled={savingSettings}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {savingSettings ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)]",
                "file:mr-3 file:px-3 file:py-1 file:rounded-lg file:border-0",
                "file:text-sm file:font-medium file:bg-[var(--color-accent)]/10 file:text-[var(--color-accent)]"
              )}
            />
          </div>

          <FolderAndVisibilityFields
            category={category}
            visibility={visibility}
            onCategoryChange={setCategory}
            onVisibilityChange={setVisibility}
          />

          {/* Require Signature toggle */}
          <div
            onClick={() => setRequireSignature(!requireSignature)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              requireSignature
                ? "border-emerald-400 bg-emerald-500/10"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
              requireSignature ? "bg-emerald-500/20" : "bg-[var(--color-surface-hover)]"
            )}>
              <Icon name="edit_note" size={16} className={requireSignature ? "text-emerald-400" : "text-[var(--color-text-muted)]"} />
            </div>
            <div className="flex-1">
              <p className={cn("text-sm font-medium", requireSignature ? "text-emerald-400" : "text-[var(--color-text-primary)]")}>
                Require Signature
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Send this document to the employee for signing (PDF only)
              </p>
            </div>
            <div className={cn(
              "h-5 w-9 rounded-full transition-colors relative",
              requireSignature ? "bg-emerald-500" : "bg-[var(--color-border)]"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                requireSignature ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setUploadOpen(false); setRequireSignature(false); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
                requireSignature
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50 transition-colors"
              )}
            >
              {requireSignature && <Icon name="edit_note" size={12} />}
              {uploading ? "Uploading..." : requireSignature ? "Upload & Send for Signing" : "Upload"}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
